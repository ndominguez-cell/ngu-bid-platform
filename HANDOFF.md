# NGU Bid Platform — M1 handoff

**Updated:** 2026-07-17

**Base:** `main` at `096340f`

**Deployment action taken:** none

**Database action taken:** none

## Outcome

M1 is implemented as local review branches. The production-derived seed data
has a synthetic replacement, the invitation flow has local tenant/role guards,
the tenant-isolation suite passes without a live database, and all requested
Supabase advisor remediations are represented in one new migration file.

Nothing from this closeout was pushed, merged to `main`, deployed, or applied
to Supabase.

## Branch state

| Branch | Contents | State |
|---|---|---|
| `security/scrub-seed-pii` | 29 synthetic bid fixtures; embedded credential URLs removed | Local commit `022f6e0`; partner review required |
| `feat/invite-collaborator` | Existing invite UI, API routes, and invitation migration | Migration already live; code still not on `main` |
| `test/tenant-isolation` | Invite prerequisite, executable tenant tests, invite role defense, advisor migration, closeout docs | Local review branch; do not apply migration yet |

The test branch carries the existing invite change so its endpoint tests and
migration chain are self-contained. If the invite branch lands first, Git can
reduce the remaining review to the test/hardening delta.

## Known drift and security state

- `20260716120000_workspace_invitations.sql` is already applied to the live
  database. Until the invite code lands, the live schema is ahead of `main`.
- `20260717120000_advisor_hardening.sql` is file-only. It has not been applied.
- `main` still contains the old production-derived seed file. The scrub exists
  only on `security/scrub-seed-pii` until the partner lands it.
- The old plan-room access key was verified dead on 2026-07-17. The historical
  SharePoint bearer link should still be expired by its owner if it remains
  active. Both URLs are absent from the synthetic seed branch.
- Git history still contains the removed data. History rewriting is a separate
  owner decision and was intentionally not attempted.

## Verification completed

```text
npm test                                      PASS (6/6)
npx tsc --noEmit --incremental false          PASS
```

The final build, PII scan, per-branch logs, status, and no-push checks are in
`nickdom0923AgentNotes/26_M1_CLOSEOUT_2026-07-17.md`.

## Partner next step

Review the closeout report, land the seed scrub first, reconcile the invite
code with the already-applied migration, then review the advisor SQL before
running it. No migration in this handoff should be applied automatically.

## M2 after M1 lands

Build the first data-backed estimating loop: workspace-owned cost observations,
a small takeoff evaluation set, public-data ingestion, and estimate suggestions
with model fallback. Cross-tenant benchmarks and price optimization remain M3.
