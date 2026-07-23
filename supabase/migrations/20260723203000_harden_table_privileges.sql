-- Explicitly restrict frontend roles to the operations used by ATLES.
-- Hard deletes are intentionally unavailable; deletions use deleted_at.

revoke all privileges on table public.profiles from anon, authenticated;
revoke all privileges on table public.goals from anon, authenticated;
revoke all privileges on table public.weight_logs from anon, authenticated;

grant select, insert, update on table public.profiles to authenticated;
grant select, insert, update on table public.goals to authenticated;
grant select, insert, update on table public.weight_logs to authenticated;
