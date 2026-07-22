-- Read-only M1 -> M2 readiness receipt. Run in the Supabase SQL editor.
-- Save the result with the deployment record; do not change rows from here.

-- 1. Expected migration-ledger entries. Missing rows are a stop condition,
-- not permission to replay every historical migration.
with expected(version, phase) as (
  values
    ('20260717120000', 'M1 advisor hardening'),
    ('20260718100000', 'M1 permissive-policy cleanup'),
    ('20260718120000', 'M2 cost observations'),
    ('20260722120000', 'M1 function search-path residue')
)
select
  expected.version,
  expected.phase,
  (applied.version is not null) as recorded
from expected
left join supabase_migrations.schema_migrations applied
  on applied.version::text = expected.version
order by expected.version;

-- 2. Both advisor-reported functions must show an explicit empty search path.
select
  namespace.nspname as function_schema,
  procedure.proname as function_name,
  pg_get_function_identity_arguments(procedure.oid) as arguments,
  procedure.proconfig
from pg_proc procedure
join pg_namespace namespace on namespace.oid = procedure.pronamespace
where namespace.nspname = 'public'
  and procedure.proname in ('handle_new_user', 'update_updated_at')
order by procedure.proname;

-- 3. M2 evidence must exist, have RLS enabled, and expose no member write policy.
select
  classes.relname as table_name,
  classes.relrowsecurity as rls_enabled,
  classes.relforcerowsecurity as rls_forced
from pg_class classes
join pg_namespace namespace on namespace.oid = classes.relnamespace
where namespace.nspname = 'public'
  and classes.relname = 'cost_observations';

select
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'cost_observations'
order by policyname;
