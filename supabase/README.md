# Supabase change safety

`supabase/migrations/` is an ordered history for migration tooling. It is not a
folder of scripts to paste together into an existing database.

## Shared/live database rules

1. Never batch-run the migration directory in the SQL Editor.
2. Never re-run `20260101000000_initial_schema.sql` on an existing database.
   It contains historical development bootstrap policies that later migrations
   replace; re-running it out of sequence can reopen cross-workspace access.
3. Review one pending migration at a time and reconcile the live migration
   ledger before using an automatic database push.
4. After any RLS change, run the read-only query in
   `verification/20260718_m1_rls_audit.sql`. A passing result is zero rows.
5. Database migrations in agent work are files only. A human with project
   authority reviews and applies them deliberately.

`20260718100000_remove_legacy_permissive_policies.sql` is the idempotent M1
incident cleanup. It drops all known permissive legacy names and changes no
tables or data.

## Other SQL directories

- `supabase/setup/` is a historical disposable-sandbox bundle, not a live
  upgrade path. Do not run it against an existing/shared project.
- `lib/supabase/schema.sql` is a legacy reference file. Do not execute it.

For a new disposable database, prefer the Supabase CLI or another migration
runner that records each timestamped migration exactly once and in order.
