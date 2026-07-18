# NGU Bid Platform — M1 handoff

**Updated:** 2026-07-18

**Base:** `main` at `096340f`

**Deployment action taken:** none

**Database action observed:** manual batch SQL run on 2026-07-17; live cleanup verification pending

## Outcome

M1 code is implemented as local review branches, but the live database is not
yet cleared for release. A manual batch run applied the advisor hardening and
also re-created legacy permissive RLS policies from the historical bootstrap
migration. The local branch now includes a final idempotent cleanup migration,
a read-only audit query, and a regression test for that failure mode.

Nothing from this Codex recheck was pushed, merged, deployed, or applied to
Supabase. The observed database action was performed separately by the user.

## Branch state

| Branch | Contents | State |
|---|---|---|
| `security/scrub-seed-pii` | 29 synthetic bid fixtures; embedded credential URLs removed | Local commit `022f6e0`; partner review required |
| `feat/invite-collaborator` | Existing invite UI, API routes, and invitation migration | Migration already live; code still not on `main` |
| `test/tenant-isolation` | Invite prerequisite, executable tenant tests, invite role defense, advisor + incident cleanup migrations, closeout docs | Local review branch; live RLS audit still required |

The test branch carries the existing invite change so its endpoint tests and
migration chain are self-contained. If the invite branch lands first, Git can
reduce the remaining review to the test/hardening delta.

## Known drift and security state

- `20260716120000_workspace_invitations.sql` is already applied to the live
  database. Until the invite code lands, the live schema is ahead of `main`.
- `20260717120000_advisor_hardening.sql` has now been applied manually, but the
  live migration ledger remains unreconciled.
- `20260718100000_remove_legacy_permissive_policies.sql` is the drop-only
  incident follow-up. Live success is verified only when
  `supabase/verification/20260718_m1_rls_audit.sql` returns zero rows.
- `main` still contains the old production-derived seed file. The scrub exists
  only on `security/scrub-seed-pii` until the partner lands it.
- The old plan-room access key was verified dead on 2026-07-17. The historical
  SharePoint bearer link should still be expired by its owner if it remains
  active. Both URLs are absent from the synthetic seed branch.
- Git history still contains the removed data. History rewriting is a separate
  owner decision and was intentionally not attempted.

## Verification completed

```text
npm test                                      PASS (7/7)
npx tsc --noEmit --incremental false          PASS
```

The final build, PII scan, per-branch logs, status, and no-push checks are in
`nickdom0923AgentNotes/26_M1_CLOSEOUT_2026-07-17.md`.

## Partner next step

Run the read-only RLS audit and confirm zero rows before treating M1 as closed.
Then land the seed scrub, reconcile invite code/schema and migration history,
and review the drop-only incident migration. No migration in this handoff
should be applied automatically.

## M2 after M1 lands

Build the first data-backed estimating loop: workspace-owned cost observations,
a small takeoff evaluation set, public-data ingestion, and estimate suggestions
with model fallback. Cross-tenant benchmarks and price optimization remain M3.
