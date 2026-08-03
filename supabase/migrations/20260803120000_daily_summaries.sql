-- ATLES daily summaries
-- One user-scoped record per local calendar day.

create table public.daily_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  summary_date date not null,
  steps integer,
  intake_kcal integer,
  active_kcal integer,
  total_kcal integer,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint daily_summaries_user_date_unique
    unique (user_id, summary_date),

  constraint daily_summaries_steps_nonnegative
    check (steps is null or steps >= 0),

  constraint daily_summaries_intake_nonnegative
    check (intake_kcal is null or intake_kcal >= 0),

  constraint daily_summaries_active_nonnegative
    check (active_kcal is null or active_kcal >= 0),

  constraint daily_summaries_total_nonnegative
    check (total_kcal is null or total_kcal >= 0)
);

create trigger daily_summaries_set_updated_at
before update on public.daily_summaries
for each row execute function public.set_updated_at();

create index daily_summaries_user_date_idx
  on public.daily_summaries (user_id, summary_date desc)
  where deleted_at is null;

alter table public.daily_summaries enable row level security;

revoke all on table public.daily_summaries from anon;
grant select, insert, update on table public.daily_summaries to authenticated;

create policy "daily_summaries_select_own"
on public.daily_summaries
for select
to authenticated
using (auth.uid() = user_id);

create policy "daily_summaries_insert_own"
on public.daily_summaries
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "daily_summaries_update_own"
on public.daily_summaries
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
