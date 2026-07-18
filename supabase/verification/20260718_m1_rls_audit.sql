-- Read-only M1 verification query. Safe to run in the Supabase SQL Editor.
-- A passing result returns zero rows.

select
  schemaname,
  tablename,
  policyname,
  cmd,
  qual,
  with_check
from pg_policies
where policyname in (
  'auth_full',
  'read_all',
  'Authenticated full access',
  'Users can view all profiles',
  'docs_upload',
  'docs_read',
  'docs_delete'
)
order by schemaname, tablename, policyname;
