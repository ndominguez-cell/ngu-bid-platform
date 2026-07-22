# M1 to M2 rollout gate

This runbook separates code readiness from live-database authority. The M2 branch can be reviewed and tested without changing production. A partner with Supabase access performs the live steps.

## Stop condition

Set `V` to the count of unmet checks below. Deploy M2 only when `V = 0`:

- the live migration ledger is reconciled with the repository;
- the final M1 RLS audit returns zero permissive legacy policies;
- `handle_new_user()` and `update_updated_at()` have an explicit empty `search_path`;
- `cost_observations` has RLS enabled, member read access, and service-role-only writes;
- Supabase leaked-password protection is enabled or its deferral is explicitly accepted;
- the app seed route contains synthetic data only.

## Partner-controlled sequence

1. Export the current `supabase_migrations.schema_migrations` rows and compare them with `supabase/migrations`. Do not batch-run the directory to repair missing history.
2. Resolve ledger-only drift deliberately. If a migration's effects already exist, record that decision instead of replaying destructive or conflicting SQL.
3. Apply only the reviewed pending deltas in filename order:
   - `20260718120000_cost_observations.sql`
   - `20260722120000_function_search_path_hardening.sql`
4. Run `supabase/verification/20260718_m1_rls_audit.sql` and then `supabase/verification/20260722_m1_m2_readiness.sql`.
5. In the Supabase dashboard, enable leaked-password protection. This setting is intentionally not automated from the repository.
6. Deploy the application branch. Open an Approved estimate and publish its cost evidence once; a successful receipt has `V: 0`.

If any query, migration, or publication returns an error, stop. Preserve the output, do not replay the whole migration history, and reconcile the specific failed delta before retrying.

## Rollback boundary

The seed scrub and function search-path settings should remain in place. If the M2 evidence feature must be disabled, roll back the application route/UI first. Retain `cost_observations` unless a partner approves a separate data-retention plan; dropping it would be destructive.
