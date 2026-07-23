-- ATLES initial Supabase schema
-- Phase 1: profiles, goals, weight logs and user-scoped RLS.

create extension if not exists pgcrypto;

-- Keep updated_at consistent without relying on the client.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  birth_date date,
  height_cm numeric,
  metabolic_sex text,
  timezone text not null default 'Europe/Madrid',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profiles_height_positive
    check (height_cm is null or height_cm > 0)
);

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  start_weight_kg numeric,
  target_weight_kg numeric not null,
  target_date date,
  weekly_goal_kg numeric,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint goals_start_weight_positive
    check (start_weight_kg is null or start_weight_kg > 0),

  constraint goals_target_weight_positive
    check (target_weight_kg > 0)
);

create table public.weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  value_kg numeric not null,
  measured_at timestamptz not null,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint weight_logs_value_positive
    check (value_kg > 0)
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger goals_set_updated_at
before update on public.goals
for each row execute function public.set_updated_at();

create trigger weight_logs_set_updated_at
before update on public.weight_logs
for each row execute function public.set_updated_at();

create index goals_user_active_idx
  on public.goals (user_id, is_active)
  where deleted_at is null;

create index weight_logs_user_measured_at_idx
  on public.weight_logs (user_id, measured_at desc)
  where deleted_at is null;

alter table public.profiles enable row level security;
alter table public.goals enable row level security;
alter table public.weight_logs enable row level security;

revoke all on table public.profiles from anon;
revoke all on table public.goals from anon;
revoke all on table public.weight_logs from anon;

grant select, insert, update on table public.profiles to authenticated;
grant select, insert, update on table public.goals to authenticated;
grant select, insert, update on table public.weight_logs to authenticated;

create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "goals_select_own"
on public.goals
for select
to authenticated
using (auth.uid() = user_id);

create policy "goals_insert_own"
on public.goals
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "goals_update_own"
on public.goals
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "weight_logs_select_own"
on public.weight_logs
for select
to authenticated
using (auth.uid() = user_id);

create policy "weight_logs_insert_own"
on public.weight_logs
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "weight_logs_update_own"
on public.weight_logs
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
