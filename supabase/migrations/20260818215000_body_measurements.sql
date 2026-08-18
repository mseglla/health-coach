-- Generic body measurements for ATLES.

create table public.body_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  measurement_type text not null,
  value numeric not null,
  unit text not null,
  measured_at timestamptz not null,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint body_measurements_value_positive
    check (value > 0)
);

create trigger body_measurements_set_updated_at
before update on public.body_measurements
for each row execute function public.set_updated_at();

create index body_measurements_user_type_measured_idx
  on public.body_measurements (
    user_id,
    measurement_type,
    measured_at desc
  )
  where deleted_at is null;

alter table public.body_measurements enable row level security;

revoke all on table public.body_measurements from anon, authenticated;
grant select, insert, update on table public.body_measurements to authenticated;

create policy "body_measurements_select_own"
on public.body_measurements
for select
to authenticated
using (auth.uid() = user_id);

create policy "body_measurements_insert_own"
on public.body_measurements
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "body_measurements_update_own"
on public.body_measurements
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
