# NGU Bid Platform

A multi-tenant construction bid-management application for tracking
opportunities, plan documents, AI-assisted estimates, proposals, team access,
and bid outcomes.

## Stack

- Next.js 14 App Router and TypeScript
- Supabase Auth, Postgres, Row Level Security, and Storage
- Tailwind CSS
- Anthropic API for takeoff, proposal, and plan-finding workflows

## M1 closeout status (2026-07-17)

> **2026-07-18 security recheck:** the advisor migration was manually applied
> during a batch SQL run, but that same run re-created legacy permissive RLS
> policies. M1 is not release-ready until
> `supabase/verification/20260718_m1_rls_audit.sql` returns zero rows. The local
> branch now includes an idempotent final cleanup migration and a regression
> test for every known legacy policy name.

`main` remains at `096340f`. M1 review work is intentionally split across
local branches and has not been merged by this closeout:

- `security/scrub-seed-pii` replaces all 29 production-derived seed bids with
  synthetic fixtures. The old data still exists on `main` and in git history
  until the partner lands the branch and separately decides whether history
  rewriting is appropriate.
- `feat/invite-collaborator` contains the existing team invitation feature.
  Its `20260716120000_workspace_invitations.sql` migration is already applied
  to the live database, but the application code is not on `main`, so the repo
  and database are temporarily out of sync.
- `test/tenant-isolation` carries the invite prerequisite, dependency-free
  tenant-isolation tests, defensive invite role handling, and a new
  advisor hardening and the incident follow-up cleanup migration. Do not run
  another database file until partner review and migration-history
  reconciliation.

The exact branch review and migration commands are recorded in
`nickdom0923AgentNotes/26_M1_CLOSEOUT_2026-07-17.md`.

## Local development

Install dependencies and start the app:

```powershell
npm install
npm run dev
```

Create a local `.env.local` with development-only values for the services you
intend to exercise. Common variables include:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ANTHROPIC_API_KEY
SEED_SECRET
NEXT_PUBLIC_APP_URL
```

Never commit environment files or production credentials.

## Verification

```powershell
npm test
npm run build
```

The tenant suite uses Node's built-in test runner. It does not require network
access, production credentials, a live Supabase project, or extra packages.
See `tests/README.md` for its scope and limitations.

## Database changes

Schema changes live in `supabase/migrations/` and are applied in timestamp
order. Migrations are reviewed as code before anyone runs them against a
shared project. In particular,
`20260717120000_advisor_hardening.sql` was applied manually on 2026-07-17. The
follow-up `20260718100000_remove_legacy_permissive_policies.sql` is drop-only and
idempotent; it removes policy names that can bypass workspace RLS. Read
`supabase/README.md` before any database work.

## Security model

- Every business row is scoped by `workspace_id`.
- Authenticated database access is restricted by workspace-member RLS.
- API routes using the service-role client authenticate the caller and scope
  each query to the caller's workspace.
- Workspace ownership cannot be granted through an invitation.
- Seed fixtures must contain only synthetic identities, `example.com` email
  addresses, `555` phone numbers, and `.test` plan-room links.
