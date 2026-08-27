-- Independent ingestion store. Existing aggregates, workouts and manual weights are unchanged.
begin;

create table public.health_samples (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    metric_type text not null check (metric_type in (
        'resting_heart_rate_bpm', 'hrv_sdnn_ms', 'vo2_max_ml_kg_min',
        'body_mass_kg', 'body_fat_percent', 'lean_body_mass_kg', 'sleep_stage'
    )),
    external_id uuid not null,
    source text not null default 'healthkit' check (source = 'healthkit'),
    started_at timestamptz not null check (isfinite(started_at)),
    ended_at timestamptz not null check (isfinite(ended_at) and ended_at >= started_at),
    value numeric,
    unit text,
    sleep_stage text,
    category_value integer,
    source_bundle_id text not null check (length(trim(source_bundle_id)) > 0),
    source_version text,
    source_device text,
    timezone text,
    import_timezone text not null check (length(trim(import_timezone)) > 0),
    was_user_entered boolean,
    imported_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,
    unique (user_id, metric_type, source, external_id),
    constraint health_samples_value_shape check (
        (metric_type = 'sleep_stage' and value is null and unit is null
            and category_value is not null and category_value >= 0
            and sleep_stage is not null
            and sleep_stage = case category_value
                when 0 then 'in_bed' when 1 then 'asleep_unspecified' when 2 then 'awake'
                when 3 then 'core' when 4 then 'deep' when 5 then 'rem' else 'unknown' end)
        or
        (metric_type <> 'sleep_stage' and sleep_stage is null and category_value is null
            and value is not null and value >= 0 and value < 'Infinity'::numeric
            and unit is not null and unit = case metric_type
                when 'resting_heart_rate_bpm' then 'bpm' when 'hrv_sdnn_ms' then 'ms'
                when 'vo2_max_ml_kg_min' then 'ml/kg/min' when 'body_fat_percent' then '%'
                else 'kg' end
            and (metric_type <> 'body_fat_percent' or value <= 100))
    )
);

-- Unknown UUID deletions also need a ledger: stale retries/devices must not resurrect them.
create table public.health_sample_tombstones (
    user_id uuid not null references auth.users(id) on delete cascade,
    metric_type text not null check (metric_type in (
        'resting_heart_rate_bpm', 'hrv_sdnn_ms', 'vo2_max_ml_kg_min',
        'body_mass_kg', 'body_fat_percent', 'lean_body_mass_kg', 'sleep_stage'
    )),
    external_id uuid not null,
    deleted_at timestamptz not null default now(),
    primary key (user_id, metric_type, external_id)
);

create trigger health_samples_set_updated_at before update on public.health_samples
for each row execute function public.set_updated_at();

create index health_samples_user_type_time_idx
on public.health_samples (user_id, metric_type, started_at desc) where deleted_at is null;

alter table public.health_samples enable row level security;
alter table public.health_sample_tombstones enable row level security;
revoke all on public.health_samples, public.health_sample_tombstones from public, anon;
grant select, insert, update on public.health_samples to authenticated;
grant select, insert on public.health_sample_tombstones to authenticated;

create policy health_samples_select_own on public.health_samples for select to authenticated
using (auth.uid() = user_id);
create policy health_samples_insert_own on public.health_samples for insert to authenticated
with check (auth.uid() = user_id);
create policy health_samples_update_own on public.health_samples for update to authenticated
using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy health_sample_tombstones_select_own on public.health_sample_tombstones
for select to authenticated using (auth.uid() = user_id);
create policy health_sample_tombstones_insert_own on public.health_sample_tombstones
for insert to authenticated with check (auth.uid() = user_id);

create function public.ingest_health_sample_page(
    p_metric_type text, p_samples jsonb default '[]'::jsonb,
    p_deleted_ids uuid[] default array[]::uuid[]
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
    v_user uuid := auth.uid();
    v_upserted integer := 0;
    v_deleted integer := 0;
begin
    if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;
    if p_metric_type is null or p_metric_type not in (
        'resting_heart_rate_bpm', 'hrv_sdnn_ms', 'vo2_max_ml_kg_min',
        'body_mass_kg', 'body_fat_percent', 'lean_body_mass_kg', 'sleep_stage'
    ) then raise exception 'Unsupported metric type' using errcode = '22023'; end if;
    if p_samples is null or jsonb_typeof(p_samples) <> 'array' then
        raise exception 'Samples must be an array' using errcode = '22023';
    end if;
    if jsonb_array_length(p_samples) > 250 or p_deleted_ids is null
        or cardinality(p_deleted_ids) > 1000 or array_position(p_deleted_ids, null) is not null then
        raise exception 'Invalid page size or deleted IDs' using errcode = '22023';
    end if;
    -- Serialize pages for one user/type, including concurrent devices and delete/add races.
    perform pg_advisory_xact_lock(hashtextextended(v_user::text || '/' || p_metric_type, 0));

    insert into public.health_sample_tombstones (user_id, metric_type, external_id)
    select v_user, p_metric_type, id from unnest(p_deleted_ids) as d(id)
    on conflict do nothing;

    insert into public.health_samples (
        user_id, metric_type, external_id, started_at, ended_at, value, unit,
        sleep_stage, category_value, source_bundle_id, source_version, source_device,
        timezone, import_timezone, was_user_entered
    )
    select v_user, p_metric_type, r.external_id, r.started_at, r.ended_at, r.value, r.unit,
        r.sleep_stage, r.category_value, r.source_bundle_id, r.source_version, r.source_device,
        r.timezone, r.import_timezone, r.was_user_entered
    from jsonb_to_recordset(p_samples) as r(
        external_id uuid, started_at timestamptz, ended_at timestamptz, value numeric,
        unit text, sleep_stage text, category_value integer, source_bundle_id text,
        source_version text, source_device text, timezone text, import_timezone text,
        was_user_entered boolean
    )
    where not exists (
        select 1 from public.health_sample_tombstones t
        where t.user_id = v_user and t.metric_type = p_metric_type and t.external_id = r.external_id
    )
    on conflict (user_id, metric_type, source, external_id) do update set
        started_at = excluded.started_at, ended_at = excluded.ended_at,
        value = excluded.value, unit = excluded.unit, sleep_stage = excluded.sleep_stage,
        category_value = excluded.category_value, source_bundle_id = excluded.source_bundle_id,
        source_version = excluded.source_version, source_device = excluded.source_device,
        timezone = excluded.timezone, import_timezone = excluded.import_timezone,
        was_user_entered = excluded.was_user_entered, imported_at = now()
    where public.health_samples.deleted_at is null;
    get diagnostics v_upserted = row_count;

    update public.health_samples set deleted_at = now()
    where user_id = v_user and metric_type = p_metric_type and source = 'healthkit'
        and external_id = any(p_deleted_ids) and deleted_at is null;
    get diagnostics v_deleted = row_count;
    return jsonb_build_object('upserted', v_upserted, 'deleted', v_deleted);
end;
$$;

revoke all on function public.ingest_health_sample_page(text, jsonb, uuid[]) from public, anon;
grant execute on function public.ingest_health_sample_page(text, jsonb, uuid[]) to authenticated;
commit;
