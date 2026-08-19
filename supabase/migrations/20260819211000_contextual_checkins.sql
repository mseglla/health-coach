-- Optional contextual check-ins for ATLES.

create table public.contextual_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  checkin_date date not null,
  feeling_score integer not null,
  note text,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint contextual_checkins_feeling_score_range
    check (feeling_score between 1 and 5),

  constraint contextual_checkins_user_date_unique
    unique (user_id, checkin_date)
);

create trigger contextual_checkins_set_updated_at
before update on public.contextual_checkins
for each row execute function public.set_updated_at();

create index contextual_checkins_user_date_idx
  on public.contextual_checkins (user_id, checkin_date desc)
  where deleted_at is null;

alter table public.contextual_checkins enable row level security;

revoke all on table public.contextual_checkins from anon, authenticated;
grant select, insert, update on table public.contextual_checkins to authenticated;

create policy "contextual_checkins_select_own"
on public.contextual_checkins
for select
to authenticated
using (auth.uid() = user_id);

create policy "contextual_checkins_insert_own"
on public.contextual_checkins
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "contextual_checkins_update_own"
on public.contextual_checkins
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
