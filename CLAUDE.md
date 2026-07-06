# NGU Bid Platform

Construction bid management app for NGU Construction (site work / paving
subcontractor, San Antonio TX). NGU **receives** bid invitations from GCs —
it does not issue them.

## Stack
- Next.js app router (`app/(app)` authed pages, `app/(auth)` login/signup), TypeScript, Tailwind
- Supabase: auth, Postgres with workspace-scoped RLS, `documents` storage bucket
- Anthropic API: email bid extraction (Haiku), plan search + takeoffs (Sonnet + web search)
- Deployed on Vercel from branch `claude/busy-rubin-jluigp` (repo owner: ndominguez-cell)

## Active Supabase project
- `ngu-bid-platform` (ref `ikdynmhgvwhfgunfeyae`, org "NGU Bid Platform", us-west-1, free tier)
- Schema lives in `supabase/migrations/` (apply in filename order). For a
  fresh project use `supabase/setup/01_full_setup.sql` + `02_seed_demo_data.sql`
  (sign up in the app BEFORE running the seed — it attaches the newest user as owner).
- New signups get role `viewer` and NO workspace until added to `workspace_members`
  (intentional; tier-0 security). Seed script promotes the newest user.

## Required env vars (Vercel + .env.local)
```
NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY
ANTHROPIC_API_KEY            # all AI features fail without it
GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REDIRECT_URI   # Gmail integration
NEXT_PUBLIC_APP_URL
```
`NEXT_PUBLIC_*` vars are baked at build time — redeploy without build cache after changing.
Gmail OAuth tokens live in `profiles` — a database swap requires reconnecting Gmail
in Settings → Integrations.

## Core pipeline
1. `POST /api/gmail/detect-bids` — scans last 21 days of Gmail (subject + body
   keywords), Haiku extracts bid data (due dates, proposed start date, GC contact,
   trades, plan links), saves PDF/image attachments to the `documents` bucket
   (path: `{workspaceId}/bids/{bidId}/…`), classified plans/specs/addendum.
2. `POST /api/bids/[id]/find-plans` — Sonnet + web search hunts public plan
   sources (TxSMARTBuy, city .gov, QuestCDN…), auto-saves high-confidence URLs.
3. Estimates: markup % + margin % lines; sitewide defaults on `workspaces`
   (`default_markup_pct` / `default_margin_pct`, editable at Settings → Estimating,
   served by `/api/settings`); per-estimate override persisted on `estimates.margin_pct`.

## Conventions
- All API routes using the service-role client MUST call `requireUser()` from
  `lib/auth.ts` and scope every query by `auth.workspaceId`.
- Colors: use CSS custom properties (`var(--navy)`, `var(--text-muted)`), never
  Tailwind color classes or hex literals — dark mode remaps the variables.
  Exception: elements that must stay dark in both themes use `#1a3a5c` literally.
- Verify with `npx tsc --noEmit` (should be clean).

## Git
- Work happens on `claude/busy-rubin-jluigp`; the Claude GitHub app is installed
  for push access. If push 403s through the session proxy, the fallback is a
  user-supplied fine-grained PAT (Contents: R/W) pushed to the explicit URL.
