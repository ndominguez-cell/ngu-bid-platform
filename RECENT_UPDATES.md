# Recent updates — NGU Bid Platform

Plain-language project status, newest first. “Pending” means the work is not on
`main` and is not part of the deployed application.

## Pending partner review

### 2026-07-17 — M1 security closeout

- Replaced the 29 production-derived seed bids with synthetic companies,
  contacts, projects, notes, and `.test` plan links on
  `security/scrub-seed-pii`.
- Removed both embedded credential-bearing URLs from the seed fixture branch.
  The old plan-room key is confirmed dead; external expiration of the historic
  SharePoint bearer link remains a human follow-up.
- Added a dependency-free six-test tenant suite covering core record RLS,
  invitation workspace scope, role-escalation resistance, advisor policies,
  service-only tables, and all 17 requested foreign-key indexes.
- Added `20260717120000_advisor_hardening.sql` for partner review only. It was
  not applied to any Supabase project.
- Refreshed the README, handoff, and closeout notes. No branch was pushed or
  merged by this work.

### 2026-07-16 — Invite collaborator feature

- The existing invite branch adds pending invitations, accept-by-token, and
  team settings UI.
- Its invitation-table migration is already present in the live database while
  the application code remains off `main`. This is the current repo/database
  drift to reconcile first.

## On `main`

### Through 2026-07-14 — Security and feedback-loop integration

- Workspace scoping and member-based RLS protect business data and storage.
- API routes authenticate service-role operations and scope them to a workspace.
- Estimate takeoff, rate limiting, security follow-ups, and bid outcome feedback
  are represented in the current mainline code and migration history.

## Next

1. Partner reviews and lands the seed scrub.
2. Partner lands the invite code to match the already-applied invitation schema.
3. Partner reviews, then explicitly applies the advisor-hardening migration.
4. Owner decides whether the private repository's history should be rewritten.
5. Start M2: cost observations, public-data ingestion, and a small takeoff eval.

Remote branch deletion is not part of this closeout. Only local stale-branch
cleanup is recommended after the partner confirms the review branches landed.
