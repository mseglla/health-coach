-- Generalize ATLES goals beyond weight-only targets.

alter table public.goals
  alter column target_weight_kg drop not null;

alter table public.goals
  add column goal_type text,
  add column title text,
  add column target_value numeric,
  add column target_unit text,
  add column metadata jsonb not null default '{}'::jsonb,
  add column is_primary boolean not null default false;

-- Backfill the existing weight-goal model.
update public.goals
set
  goal_type = 'weight',
  title = coalesce(title, 'Objectiu de pes'),
  target_value = target_weight_kg,
  target_unit = 'kg'
where goal_type is null;

alter table public.goals
  alter column goal_type set not null,
  alter column title set not null,
  alter column target_value set not null,
  alter column target_unit set not null;

alter table public.goals
  add constraint goals_target_value_positive
  check (target_value > 0);

-- Preserve one primary active goal per user.
with ranked as (
  select
    id,
    row_number() over (
      partition by user_id
      order by updated_at desc, created_at desc
    ) as position
  from public.goals
  where is_active = true
    and deleted_at is null
)
update public.goals as goals
set is_primary = true
from ranked
where goals.id = ranked.id
  and ranked.position = 1;

create unique index goals_user_primary_active_idx
  on public.goals (user_id)
  where is_primary = true
    and is_active = true
    and deleted_at is null;
