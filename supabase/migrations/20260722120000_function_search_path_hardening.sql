-- M1 residue carried into the M2 rollout: pin mutable function search paths.
-- File only. Apply through supabase/M1_M2_ROLLOUT.md after migration-history
-- reconciliation; do not batch-replay historical migrations.

do $migration$
begin
  if to_regprocedure('public.handle_new_user()') is null then
    raise exception 'Expected function public.handle_new_user() is missing';
  end if;
  if to_regprocedure('public.update_updated_at()') is null then
    raise exception 'Expected function public.update_updated_at() is missing';
  end if;
end
$migration$;

-- handle_new_user already schema-qualifies public.profiles. update_updated_at
-- only assigns NEW.updated_at. Neither function needs name resolution.
alter function public.handle_new_user() set search_path = '';
alter function public.update_updated_at() set search_path = '';
