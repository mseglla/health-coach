-- ATLES HealthKit foundation
-- Phase 1B: automatic daily health metrics and activity logs.

create table public.health_daily_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  metric_date date not null,
  metric_type text not null,
  value numeric not null,
  unit text not null,
  source text not null default 'healthkit',
  source_bundle_id text,
  source_device text,
  timezone text,
  metadata jsonb not null default '{}'::jsonb,
  imported_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint health_daily_metrics_identity_unique
    unique (user_id, metric_date, metric_type, source),

  constraint health_daily_metrics_type_allowed
    check (metric_type in ('steps', 'active_kcal', 'total_kcal')),

  constraint health_daily_metrics_value_nonnegative
    check (value >= 0),

  constraint health_daily_metrics_unit_not_blank
    check (length(trim(unit)) > 0),

  constraint health_daily_metrics_source_not_blank
    check (length(trim(source)) > 0)
);

create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_type text not null,
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_minutes numeric,
  active_calories numeric,
  distance_meters numeric,
  steps integer,
  notes text,
  source text not null default 'manual',
  external_id text,
  source_bundle_id text,
  source_device text,
  timezone text,
  metadata jsonb not null default '{}'::jsonb,
  imported_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint activity_logs_external_identity_unique
    unique (user_id, source, external_id),

  constraint activity_logs_type_not_blank
    check (length(trim(activity_type)) > 0),

  constraint activity_logs_end_not_before_start
    check (ended_at is null or ended_at >= started_at),

  constraint activity_logs_duration_nonnegative
    check (duration_minutes is null or duration_minutes >= 0),

  constraint activity_logs_active_calories_nonnegative
    check (active_calories is null or active_calories >= 0),

  constraint activity_logs_distance_nonnegative
    check (distance_meters is null or distance_meters >= 0),

  constraint activity_logs_steps_nonnegative
    check (steps is null or steps >= 0),

  constraint activity_logs_source_not_blank
    check (length(trim(source)) > 0)
);

create trigger health_daily_metrics_set_updated_at
before update on public.health_daily_metrics
for each row execute function public.set_updated_at();

create trigger activity_logs_set_updated_at
before update on public.activity_logs
for each row execute function public.set_updated_at();

create index health_daily_metrics_user_date_idx
  on public.health_daily_metrics (user_id, metric_date desc)
  where deleted_at is null;

create index activity_logs_user_started_at_idx
  on public.activity_logs (user_id, started_at desc)
  where deleted_at is null;

alter table public.health_daily_metrics enable row level security;
alter table public.activity_logs enable row level security;

revoke all on table public.health_daily_metrics from anon;
revoke all on table public.activity_logs from anon;

grant select, insert, update on table public.health_daily_metrics to authenticated;
grant select, insert, update on table public.activity_logs to authenticated;

create policy "health_daily_metrics_select_own"
on public.health_daily_metrics
for select
to authenticated
using (auth.uid() = user_id);

create policy "health_daily_metrics_insert_own"
on public.health_daily_metrics
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "health_daily_metrics_update_own"
on public.health_daily_metrics
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "activity_logs_select_own"
on public.activity_logs
for select
to authenticated
using (auth.uid() = user_id);

create policy "activity_logs_insert_own"
on public.activity_logs
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "activity_logs_update_own"
on public.activity_logs
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
