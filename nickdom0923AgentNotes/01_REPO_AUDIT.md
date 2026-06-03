# 01 — Repo Audit (as of 2026-05-27)

> **Audience:** any AI assistant or human onboarding to this codebase.
> **Author:** Claude (Cowork), at Nick Dominguez's direction, 2026-05-27.
> **Status:** read-only audit. No code was modified to produce this note.

A focused walkthrough of what's actually here, what works well, and what gaps are worth naming. Companion files: [`00_SCOPE_AND_GOALS.md`](./00_SCOPE_AND_GOALS.md) for the bigger picture, [`02_TENANT_ISOLATION_BUG.md`](./02_TENANT_ISOLATION_BUG.md) for the urgent gap that gets its own treatment.

---

## 1. Stack

Confirmed from `package.json`, `.env.local.example`, `vercel.json`, and `middleware.ts`:

- **Framework:** Next.js `14.2.29` (App Router), TypeScript `^5`, React `^18`.
- **Styling:** Tailwind `^3.4.1`, `lucide-react` icons, `clsx` for class composition, `date-fns` for date math.
- **Backend services:** Supabase (`@supabase/supabase-js ^2.45.4`, `@supabase/ssr ^0.5.2`) for Postgres, Auth, Storage, RLS, and Realtime.
- **AI:** `@anthropic-ai/sdk ^0.99.0` — `claude-sonnet-4-6` for reasoning-heavy work (estimate generation, proposal drafting, plan-finder web search), `claude-haiku-4-5-20251001` for fast structured extraction (Gmail bid detection, CRM contact parsing).
- **Hosting:** Vercel. `vercel.json` extends function timeouts: 60s for estimates / proposal draft / Gmail sync, 120s for Gmail detect-bids, 300s for the plan-finder web search loop.
- **Auth:** Supabase Auth, enforced by `middleware.ts` — unauthenticated users are bounced to `/login` on any non-public route.

## 2. Folder layout

```
ngu-bid-platform/
├── app/
│   ├── (app)/                       protected pages (sidebar layout)
│   │   ├── dashboard/               KPI cards, upcoming bids, status breakdown
│   │   ├── bids/                    list, new, detail, Gmail import button
│   │   ├── estimates/               list, new (PDF upload → AI), detail editor, print view
│   │   ├── proposals/               list, detail, send-via-Gmail button
│   │   ├── crm/                     companies + contacts, Gmail sync button
│   │   ├── analytics/               win rate, pipeline, win-by-source, top trades
│   │   ├── settings/                profile, Gmail connect/disconnect, team manager
│   │   └── layout.tsx               AppShell + Sidebar
│   ├── (auth)/                      login, signup
│   ├── api/                         REST endpoints (next section)
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx                     redirects to /dashboard
├── components/
│   ├── layout/                      AppShell, Sidebar
│   └── notifications/               NotificationBell (Supabase Realtime)
├── lib/
│   ├── gmail.ts                     OAuth token refresh + fetch helper
│   ├── supabase/
│   │   ├── client.ts                browser client
│   │   ├── server.ts                server + service-role clients
│   │   └── schema.sql               single-file migration (all tables, triggers, RLS)
│   ├── types.ts                     TypeScript shapes for every domain entity
│   └── utils.ts                     formatters, status colors, urgency helpers
├── middleware.ts                    route protection
├── DEPLOY.md                        end-to-end deployment guide + Phase 1/2/3 changelog
└── package.json, vercel.json, tsconfig.json, tailwind.config.ts, next.config.mjs
```

## 3. API routes

Twenty endpoints under `app/api/`, grouped by purpose:

| Route | Method(s) | Purpose |
|---|---|---|
| `/api/bids` | GET, POST | List all bids; create a bid. |
| `/api/bids/[id]` | GET, PATCH, DELETE | One bid CRUD. |
| `/api/bids/[id]/find-plans` | POST | AI plan-finder with web search (300s timeout). |
| `/api/estimates` | POST | Generate an estimate from uploaded PDFs via Sonnet 4.6 (60s). |
| `/api/estimates/[id]` | GET, PATCH, DELETE | One estimate CRUD. |
| `/api/estimates/presign` | POST | Presigned URLs for direct Supabase Storage upload (bypasses Vercel's 4.5MB limit). |
| `/api/proposals/draft` | POST | Generate a proposal email body via Sonnet 4.6. |
| `/api/proposals/[id]/send` | POST | Send via Gmail API; mark proposal Sent. |
| `/api/gmail/sync` | POST | Pull recent emails, extract contacts/companies via Haiku, upsert. |
| `/api/gmail/detect-bids` | POST | Scan inbox for bid invitations via Haiku, auto-create BID-YYYY-NNN records. |
| `/api/auth/google` | GET | Start Google OAuth flow. |
| `/api/auth/google/callback` | GET | OAuth return — store refresh/access tokens on `profiles`. |
| `/api/profile` | GET, PATCH | Logged-in user profile read/write. |
| `/api/team` | GET, PATCH | Team member list, role change. |
| `/api/seed` | POST | One-time data import from `bids.json` (gated by `SEED_SECRET`). |

## 4. Domain model

`lib/supabase/schema.sql` is the single source of truth — one file, runs in Supabase SQL Editor, idempotent (uses `if not exists` and `do $$ begin ... end $$` guards).

Entities and key relationships:

- **`bids`** — primary key is a human-readable `BID-2026-001` string, not a UUID. Status pipeline: New → Reviewing → Active → Submitted → Won / Lost / Declined / Expired. `trades` is a Postgres `text[]`. `our_bid_amount` and `awarded_amount` are `numeric(12,2)`. Has `thread_id` for the originating Gmail thread.
- **`companies`** — GC / Owner / Architect / Engineer / Subcontractor / Other. Defaults `state` to TX.
- **`contacts`** — belong to a company (nullable FK), tracked with `source` ('gmail' / 'plans' / 'manual') for dedupe.
- **`estimates`** — belong to a bid. `line_items` is JSONB (array of `{trade, description, qty, unit, unit_price, total}`). `ai_summary` holds Claude's narrative description. `markup_pct numeric(5,2) default 10.0`.
- **`proposals`** — belong to a bid, optionally linked to an estimate. Distinct `body_draft` (Claude output) and `body_final` (after human edit). `gmail_thread_id` records the sent thread.
- **`documents`** — plans / specs / addenda / proposals / estimates / other. `storage_path` points into the Supabase `documents` bucket.
- **`bid_activity`** — audit log keyed by bid. Type enum covers status changes, notes, calls, file uploads, AI events.
- **`conversations`** — email threads linked to a bid and/or contact.
- **`profiles`** — extends `auth.users` with `full_name`, `title`, `avatar_url`, `role` (admin / estimator / viewer), and Gmail OAuth tokens. Auto-created via `handle_new_user()` trigger on signup.

Triggers:
- `handle_new_user()` (security definer) inserts a row into `profiles` whenever a new `auth.users` row appears.
- `update_updated_at()` keeps `updated_at` fresh on `bids`, `estimates`, `proposals`, `companies`, `contacts`.

RLS: enabled on every domain table. **All policies are `using (true) with check (true)` for any authenticated user** — see `02_TENANT_ISOLATION_BUG.md`. There is a commented-out Phase 3 block at the bottom of `schema.sql` with role-aware policies and a `get_user_role()` helper, ready to enable when the team wants strict role enforcement.

## 5. The four AI surfaces (in production code paths)

These are the substantive AI integrations. Worth understanding deeply because they are the heart of the product and the most reusable parts.

### 5.1 Gmail bid detection — `app/api/gmail/detect-bids/route.ts`

Searches the inbox for `bid OR "invitation to bid" OR RFP OR RFQ OR ...` keywords, pulls up to 30 messages, and for each one that isn't already linked to a bid (`thread_id` dedupe), sends the From/Subject/Body to Haiku with a prompt asking: *is this a real subcontractor bid invitation? If yes, extract `{project_name, address, gc, due_date, scope, trades, plans_link, source}`*. On a `{is_bid: true}` response, generates the next `BID-2026-NNN` and inserts the bid + a `conversations` row.

Notable: uses Haiku (fast and cheap) for the binary + extraction; falls through cleanly on parse errors; dedupes on `thread_id` so re-runs are safe.

### 5.2 PDF → Estimate — `app/api/estimates/route.ts`

Takes `storage_paths` (presigned-uploaded PDF locations) plus `bid_id` and `name`. Currently the AI prompt is given the **filenames only**, not the PDF contents — see `01.6` gap below. Sonnet 4.6 returns JSON with `{ai_summary, line_items[], total_amount, markup_pct, notes}`. The route recomputes `total_amount` from the line items + markup before insertion (good — doesn't trust Claude's arithmetic). Inserts estimate + one `documents` row per uploaded file.

Prompt anchors the AI to "trades NGU performs" and "current Texas market rates (2025-2026)" — both of those become per-workspace config items in the Stage 2 generalization (see [`03_GENERALIZATION_NOTES.md`](./03_GENERALIZATION_NOTES.md)).

### 5.3 Proposal email draft — `app/api/proposals/draft/route.ts`

Pulls the bid + (optional) estimate, formats a prompt with project name, location, GC, scope, total, line-item summary, due date, submit-to address. Sonnet 4.6 returns a complete email starting with `SUBJECT: ...`. The route splits subject from body and stores both `body_draft` and `body_final` as the same starting text (user edits `body_final`). Signature block is currently hardcoded to "Nick Dominguez, NGU Construction, ndominguez@nguconstruction.com" — generalization candidate.

### 5.4 Bid plan finder — `app/api/bids/[id]/find-plans/route.ts`

The most interesting one. Sonnet 4.6 with the `web_search_20250305` server-side tool, run in a multi-turn loop (up to 8 iterations) that handles `tool_use` and `pause_turn` stop reasons gracefully. The system prompt encodes a 5-tier search ladder:

1. Exact identifiers (project name + bid number)
2. Owner and municipality (`site:[city].gov`)
3. Engineer / architect (`site:[engineer].com`)
4. Document-type searches (`"project manual"`, `"addendum no"`)
5. Public records / agenda packets

Plus Texas-specific anchors: `txsmartbuy.gov`, `txdot.gov`, QuestCDN / PlanHub / BidSync free metadata pages. Verification requires two anchors out of {project, bid number, owner, address, engineer, due date}. Returns a structured JSON report `{result, plans_url, confidence, sources_checked[], document_checklist, recommended_next_step}`. Auto-saves a high-confidence URL back to `bids.plans_link`.

This is the route most directly worth generalizing to other verticals — the ladder is "search ladder for procurement documents in a regulated domain," not "search ladder for construction plans." Same pattern works for state HVAC code inspections, electrical permit packets, etc.

## 6. What works well

- **Single-file schema.** `schema.sql` is the entire database. Easy to read, easy to re-apply, no migration tooling needed. Good fit for the team size.
- **RLS is at least enabled.** The current policy is wide open (see `02`), but the foundation is there — turning on per-tenant scoping is a policy rewrite, not an architectural pivot. (Caveat below in §7: several routes bypass RLS entirely via the service-role client, which undermines this defense-in-depth.)
- **Two Supabase client helpers exist** (`createClient` for request-scoped + RLS-respecting calls, `createServiceClient` for admin-level operations). The pattern is sound; the routes that use it are inconsistent — see §7.1 and §7.8.
- **Generous function timeouts via `vercel.json`** — AI routes won't get killed at 10s. The plan-finder's 300s ceiling is the right call for multi-turn web search.
- **Direct-upload PDFs via presigned URLs** sidesteps Vercel's 4.5MB body cap. The 100,000 KB ceiling (Supabase Pro) is documented in `DEPLOY.md`.
- **JSON parsing is defensive** — every AI route has a `try { JSON.parse } catch { fallback }` shape and a regex `match(/\{[\s\S]*\}/)` to handle Claude wrapping JSON in prose.
- **`DEPLOY.md` is genuinely operable.** A new operator could set this up from scratch in an evening. Phase 1/2/3 changelog at the bottom is a clear record of what shipped when.

## 7. Gaps worth flagging

Listed by stakes, highest first. Items 7.1, 7.2, and 7.3 were elevated after Cursor's debug passes (`04`, `05`) and Codex's independent walkthrough (`06`) — they are more urgent than I (Claude) flagged in the initial audit. None are catastrophic for NGU-only use, but they are fix-before-anything-else if the URL is reachable from the public internet (which it is).

### 7.1 Unauthenticated `/api/*` access with service-role bypass (most urgent)

`middleware.ts` marks every `/api/*` path as a public route (`path.startsWith('/api/')` is in the `isPublicRoute` allow list), and several API handlers create a service-role Supabase client without verifying `auth.getUser()` first. Concretely: `app/api/bids/route.ts`, `app/api/bids/[id]/route.ts`, `app/api/estimates/route.ts`, and `app/api/proposals/draft/route.ts` are all callable by an anonymous client and will read/write rows because the service-role client bypasses RLS.

This is a strictly larger exposure than the tenant-isolation issue in §7.2 — that one requires a free signup, this one requires nothing. Full details in `04_CURSOR_DEBUG_FINDINGS.md` §1. The fix is a shared `requireUserContext()` helper (sketched in `06_CODEX_REPO_READ_AND_FORWARD_IDEAS.md` §4.1) that every API route calls before doing any DB work.

### 7.2 Self-role escalation through `/api/profile`

`PATCH /api/profile` accepts and writes `role` along with `full_name` and `title`, and the corresponding settings UI exposes the field. Any signed-in user can promote themselves to `admin` and then call admin-only endpoints. Full details in `05_CURSOR_SECOND_PASS_AND_FORWARD_IDEAS.md` §A.1. Fix is one-line: drop `role` from the writable fields on `/api/profile`, route role changes through `/api/team` with an admin check.

### 7.3 Tenant isolation

Every authenticated user can read and write every row in every domain table. Detailed treatment in [`02_TENANT_ISOLATION_BUG.md`](./02_TENANT_ISOLATION_BUG.md). Confirmed independently by Cursor `04` §2 and Codex `06` §2.

### 7.4 OAuth callback `state` is not session-bound

`app/api/auth/google/route.ts` passes `state: user.id`, and `app/api/auth/google/callback/route.ts` trusts whatever `state` value comes back and writes Gmail tokens onto that `profiles` row via the service-role client. There's no nonce, no session check that the returned state matches the active session. Detailed in `04_CURSOR_DEBUG_FINDINGS.md` §3. Standard fix: store a server-side nonce in a signed cookie before redirecting to Google, verify it on callback in addition to confirming the signed-in user matches.

### 7.5 Gmail sync upserts assume unique constraints that don't exist

`app/api/gmail/sync/route.ts` calls `upsert(..., { onConflict: 'name' })` on `companies` and `upsert(..., { onConflict: 'email' })` on `contacts`. Neither column has a unique constraint in `schema.sql`. The upserts will fail at runtime when Postgres can't find a conflict target. Cursor `04` §4. Either add the unique indexes or switch to manual select-then-insert/update.

### 7.6 Estimate AI sees filenames, not PDF contents

`app/api/estimates/route.ts` builds the prompt from `file_names` only — the actual PDF bytes are not sent to Claude. The prompt asks it to "base quantities on the project type inferred from filenames," which means the estimate is essentially `["this looks like a parking lot job"] → guess`. This is presumably a Phase-1 placeholder waiting for either (a) PDF text extraction + send-as-text or (b) Anthropic's PDF document input. Codex `06` §3.1 endorses this as the single highest-leverage quality improvement after the security work.

### 7.7 Document MIME type is hardcoded as `application/pdf`

`app/(app)/estimates/new/page.tsx` accepts `.pdf,image/*` in the file picker, `app/api/estimates/presign/route.ts` correctly forwards the MIME type, but `app/api/estimates/route.ts` writes every document into the `documents` table as `mime_type: 'application/pdf'`. Confirmed in Cursor `05` §A.4 and Codex `06` §3.6. Pass the real MIME type through.

### 7.8 Service-role vs request-scoped client usage is inconsistent

This is the cross-cutting version of 7.1. Some routes correctly verify the user (`/api/gmail/sync`, `/api/gmail/detect-bids`), others bypass RLS via service-role without any check. Cursor `05` §A.5 catalogs this. Standardize via the `requireUserContext()` helper from Codex `06` §4.1.

### 7.9 Print page uses browser handlers in a server component

`app/(app)/estimates/[id]/print/page.tsx` is a server component but renders `onClick={() => window.print()}` and `onClick={() => window.close()}` buttons. Either fails a production build or the handlers don't hydrate. Codex `06` §3.1. Fix is small: extract a `PrintActions.tsx` client component.

### 7.10 Dashboard quick actions misroute

The dashboard's `+ New Bid` button links to `/bids` (list page) instead of `/bids/new`, and `Upload Plans` links to `/estimates` instead of `/estimates/new`. Small UX paper cut but exactly the kind of thing rushed users hit. Codex `06` §3.2.

### 7.11 Broken CRM links

`app/(app)/crm/page.tsx` links to `/crm/companies/new`, `/crm/contacts/new`, and `/crm/companies/[id]` — none of those routes exist in the repo. Cursor `04` §5 and Codex `06` §3.7. Hide the buttons or add the routes.

### 7.12 New-Bid form can fail when ID is blank

`app/(app)/bids/new/page.tsx` lets the user leave ID blank and sends `id: undefined`. `bids.id` is `text primary key` with no default, and `POST /api/bids` does a raw insert. Cursor `05` §A.2. Fix: have the API route always call `nextBidId()` when no ID is provided (and once `workspace_id` exists, scope the sequence per workspace per Cursor `04` §6 and Codex `06` §3.3).

### 7.13 Source enum drift

The New Bid form offers `Other` as a source. The Gmail extraction prompt only emits `PlanHub | Procore | Novel | Direct | Gmail`, and the analytics page only reports those five — `Other`-tagged bids will silently disappear from analytics. Cursor `05` §A.3 and Codex `06` §3.8. Centralize a `BID_SOURCES` constant in `lib/utils.ts` and use it everywhere.

### 7.14 `bid_activity` exists but is barely written

The table is well-shaped and exactly what Stage 3 analytics needs (see Codex `06` §3.4), but the app only writes to it on proposal send. Status changes, estimate creation, document upload, proposal draft, and Gmail import all silently skip it. Add rows in those code paths; it's low-cost insurance for later analytics.

### 7.15 `.env.local.example` lags shipped code

The example file lists Supabase + Anthropic + `NEXT_PUBLIC_APP_URL`. The code also needs `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, and `SEED_SECRET`. `DEPLOY.md` mentions them later but new contributors usually start from the env example. Codex `06` §3.5. One-line fix.

### 7.16 Bid ID race condition

`nextBidId()` does a read-max-then-increment in app code. Two parallel inserts can compute the same ID. Cursor `04` §6 and Codex `06` §3.3. Move to a DB-side atomic strategy (Postgres sequence per workspace, or `select ... for update` inside a transaction).

### 7.17 `SEED_SECRET` gates `/api/seed` with a static query param

`?secret=ngu2026seed` in the URL is fine for one-time data import. If the endpoint stays in production, worth either removing it or moving the secret to a header. Low stakes — just hygiene.

### 7.18 No automated tests

No `tests/` folder, no Jest / Vitest / Playwright config in `package.json`. Reasonable for v1 shipping speed; worth adding lightweight tests around the JSON-extraction helpers in the AI routes and the schema policies before the multi-tenant refactor lands. A smoke test that "user A can't see user B's bids" would have caught the current state. Cursor `05` §C.1 sketches a minimal security smoke-test checklist.

### 7.19 Signup is fully self-serve and unrestricted

Anyone with the URL can create an account. Combined with 7.3 this is the actual exposure. In a multi-tenant world the signup flow has to either (a) create a new empty workspace for the user, or (b) only allow signup via invitation token. Both are normal patterns — TBD with the partner which one fits Stage 3 onboarding UX. Codex `07` §3 Priority 2 leans toward invite-first with optional shared-domain auto-join.

### 7.20 No structured logging on AI routes

Routes log `console.error('Estimate error:', err)` but don't capture request/response shape, token usage, or latency. As AI costs grow and edge cases surface, having even a simple `ai_runs` table or `bid_activity` row per AI invocation (with cost and latency) would pay off. Codex `06` §4.5 sketches this.

---

## 8. Summary

The codebase is small, coherent, and shipped. The four AI surfaces are the most substantive part and the most reusable; the rest is a competent Next.js + Supabase shell.

The gaps cluster into three layers, each of which has to be solid before the next is worth working on. Cursor and Codex independently arrived at the same framing — captured in Codex `06` §6: *every action should know who did it, which workspace it belongs to, what changed, and whether the user was allowed to do it.* Right now none of those four are reliably true.

1. **Identity** — does every API call know who's calling it? (§7.1, §7.2, §7.4, §7.8)
2. **Tenancy** — does every row know which workspace it belongs to and does every query scope to that? (§7.3, §7.16)
3. **Workflow correctness** — does the app reliably do what its UI claims, and does it record what happened? (§7.5–§7.7, §7.9–§7.15, §7.20)

If you're picking this up as a partner-side AI assistant, the high-leverage reads are: `schema.sql`, the four AI route handlers listed in §5, `middleware.ts`, and the chain of `requireUserContext()`-style work proposed across `04`/`05`/`06`. That's ~600 lines of existing code plus one new helper, and it's most of what the product *is* — and most of what it needs to become trustworthy.

---

*Audit performed 2026-05-27 by Claude against repo state at that date. Specific line numbers will drift; re-verify before quoting. Updated 2026-05-27 to absorb Cursor's two debug passes (`04`, `05`) and Codex's repo read (`06`) — §7 expanded from seven items to twenty, §6 caveated, §8 reframed around the identity/tenancy/correctness layering Codex `06` §6 names.*
