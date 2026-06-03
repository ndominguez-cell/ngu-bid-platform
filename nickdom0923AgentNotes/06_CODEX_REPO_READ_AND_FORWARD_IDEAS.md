# 06 - Codex Repo Read + Forward Ideas

> **Audience:** Nick, the partner, and future assistants.
> **Author:** Codex, 2026-05-27.
> **Scope:** Read the existing `00`-`05` notes, then walked the repo source, config, schema, deployment notes, and UI/API routes. This note is additive only; no app files were changed.

---

## 1. High-level read

The existing notes are directionally right. This is a compact but real Next.js/Supabase product with four valuable AI surfaces:

- Gmail bid detection.
- Document upload to estimate generation.
- Proposal drafting and Gmail send.
- Bid plan finding with Claude web search.

The product shape is good enough to be worth hardening. The biggest risk is still not product-market risk; it is trust. `02`, `04`, and `05` all point at the same foundation issue from different angles: the app currently behaves like a single-company internal tool while the auth/signup/API surface behaves like a public SaaS.

My recommended frame: treat the next sprint as a **trust and workflow correctness sprint**, not a feature sprint. Close the data exposure paths first, then make the estimator workflow more reliable.

---

## 2. What I would treat as ratified from `00`-`05`

These earlier findings are strong enough that I would not spend much more time debating them:

- **Tenant isolation is the urgent architecture fix.** `02_TENANT_ISOLATION_BUG.md` gives the right shape: `workspaces`, `workspace_members`, `workspace_id` on domain tables, scoped RLS, backfill existing NGU rows, then enforce `not null`.
- **Public API exposure is at least as urgent as page-level tenant isolation.** `04_CURSOR_DEBUG_FINDINGS.md` correctly notes that `middleware.ts:34` marks `/api/*` public, while routes such as `app/api/bids/route.ts:5`, `app/api/bids/route.ts:15`, `app/api/estimates/route.ts:10`, and `app/api/proposals/draft/route.ts:10` use the service-role client without a user check.
- **Self-role escalation should be fixed immediately.** `05_CURSOR_SECOND_PASS_AND_FORWARD_IDEAS.md` is correct: `app/api/profile/route.ts:9` accepts `role`, `app/api/profile/route.ts:14` writes it, and `app/(app)/settings/ProfileEditor.tsx:16` exposes `admin` in the user's own profile editor.
- **The estimate AI is not yet document-aware.** `app/api/estimates/route.ts` builds the AI prompt from filenames, not PDF/image contents. That is probably the highest-leverage quality improvement after security.

---

## 3. Additional findings from this pass

### 3.1 Likely build/runtime issue: print page uses browser handlers in a server component

`app/(app)/estimates/[id]/print/page.tsx` is a server component by default, but it renders buttons with `onClick={() => window.print()}` and `onClick={() => window.close()}` at lines 63 and 69.

Next App Router server components cannot own browser event handlers. This likely fails a production build or causes the print controls not to hydrate correctly. The clean fix is tiny: move the print/close buttons into a small `PrintActions.tsx` client component and import it from the print page.

I could not run a build locally because `node_modules` is not installed in this checkout; `npm run lint` failed with `next` not found.

### 3.2 Dashboard quick actions point to list pages, not action pages

The dashboard quick action labeled `+ New Bid` links to `/bids` at `app/(app)/dashboard/page.tsx:141`, and `Upload Plans` links to `/estimates` at line 144. Those labels imply direct actions, but the URLs go to list pages.

Suggested fix:

- `+ New Bid` -> `/bids/new`
- `Upload Plans` -> `/estimates/new`

Small UX paper cut, but it matters because dashboard quick actions are where rushed users click first.

### 3.3 Seeded data contains intentional or accidental duplicate Gmail thread IDs

The seed data has repeated `thread_id` values across many bids in `app/api/seed/route.ts`. That may be intentional because one PlanHub digest email contains multiple projects. But the Gmail detector dedupes by `thread_id` only in `app/api/gmail/detect-bids/route.ts`, so a future digest-style email with multiple bid opportunities would only allow the first created bid and skip the rest.

Suggested fix: make Gmail dedupe use a composite signal instead of `thread_id` alone:

- `thread_id`
- normalized `project_name`
- normalized due date
- optional source/platform

In the schema, that becomes a future unique index such as `(workspace_id, thread_id, normalized_project_key)` once `workspace_id` exists.

### 3.4 Activity/audit table exists but the app barely uses it

`bid_activity` is a good table in `lib/supabase/schema.sql:80`, but most important workflow actions do not write to it:

- bid status updates only patch `bids` in `app/api/bids/[id]/route.ts:20`
- estimate creation does not stamp `created_by` in `app/api/estimates/route.ts:88`
- uploaded documents do not stamp `uploaded_by` in `app/api/estimates/route.ts:104`
- proposal send does stamp `sent_by` in `app/api/proposals/[id]/send/route.ts:51`

This matters for the Stage 3 analytics idea in `00`: win/loss and time-to-submit predictions need reliable event history. The table is already there; the app just needs to write rows on status changes, estimate creation, file upload, proposal draft, proposal send, and Gmail import.

### 3.5 Environment example is behind the shipped app

`.env.local.example` only lists Supabase, Anthropic, and `NEXT_PUBLIC_APP_URL` (`.env.local.example:8`-`16`). The code now also needs:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`
- `SEED_SECRET`

`DEPLOY.md` documents those later, but local setup usually starts from `.env.local.example`, so new contributors can land in a confusing state where Gmail and seed routes fail even though they copied the example exactly.

### 3.6 File upload metadata loses the actual MIME type

This confirms and extends `05`: the client accepts PDFs and images (`app/(app)/estimates/new/page.tsx:30`, `:234`), presign receives `mimeType` (`app/api/estimates/presign/route.ts:9`), but the estimate route writes every document as `mime_type: 'application/pdf'` (`app/api/estimates/route.ts:109`).

Suggested fix: return/store `{ path, original_name, mime_type, size }` from the upload step and send that document metadata into `/api/estimates`, rather than parallel `storage_paths` and `file_names` arrays.

### 3.7 CRM has company routes in the UI but only contact detail route in code

Cursor already caught broken CRM links, and I am adding the exact UX implication: `app/(app)/crm/page.tsx:30`, `:33`, and `:96` link to company/contact create and company detail routes, but the repo only has `/crm` and `/crm/[id]`.

The least-surprising short-term fix is to hide unavailable buttons and make company rows non-clickable until those routes exist. The better fix is to add:

- `/crm/companies/new`
- `/crm/companies/[id]`
- `/crm/contacts/new`

### 3.8 Source taxonomy is drifting

Manual bid creation offers `Other` at `app/(app)/bids/new/page.tsx:111`, but analytics only includes `PlanHub`, `Procore`, `Novel`, `Direct`, and `Gmail` at `app/(app)/analytics/page.tsx:39`. The bids table will store `Other`, but analytics will omit it.

This is small now and painful later. I would centralize `BID_SOURCES` beside `BID_STATUSES` in `lib/utils.ts`, use it in the form, badges, Gmail extraction prompt, and analytics.

---

## 4. Forward ideas that push the app without overbuilding

### 4.1 Establish one request context helper

Before adding features, create a single helper that every API route uses:

```ts
requireUserContext()
```

It should return `{ user, supabase, serviceClient, activeWorkspaceId, role }` and perform the common checks. At first `activeWorkspaceId` can be the user's only workspace. Later it can come from a cookie/profile setting. This avoids every route inventing its own mix of `createClient()`, `auth.getUser()`, `createServiceClient()`, role checks, and workspace checks.

### 4.2 Make "viewer" a real read-only role

Right now the role labels promise permissions the database/app do not consistently enforce. Once self-promotion is closed, enforce viewer restrictions in app routes:

- viewers can read bids, estimates, proposals, CRM
- viewers cannot create/update/delete
- estimators can create/edit workflow records
- admins manage team/workspace settings

This can happen before full workspace RLS, though the final version should live in RLS too.

### 4.3 Add a "Bid Intake Review" queue

Instead of Gmail detection immediately creating final bid rows, import detections into a review queue:

- suggested project name, GC, due date, trades, source, confidence
- possible duplicate warnings
- accept/merge/ignore actions

This gives NGU operational control and creates a safer place for AI uncertainty. It also helps Stage 3 SaaS onboarding because every company will want to tune what counts as a valid bid invite.

### 4.4 Make estimates explain their assumptions

Once PDFs/images are actually read, have the estimate output include an `assumptions` array and `source_refs` per line item:

```json
{
  "description": "4 inch concrete sidewalk",
  "qty": 1200,
  "unit": "SF",
  "source_refs": ["C2.1", "sheet note 7"],
  "assumptions": ["Assumed 4 inch depth where detail was not visible"]
}
```

This is more useful to an estimator than a single summary paragraph, and it creates structured training/evaluation data for later quality scoring.

### 4.5 Add a lightweight AI invocation log

Add an `ai_runs` table or write structured rows into `bid_activity` with:

- route/surface (`gmail_detect`, `estimate`, `proposal_draft`, `plan_finder`)
- model
- latency
- token usage if available
- success/error
- linked `bid_id`, `estimate_id`, or `proposal_id`

This supports cost control, debugging, and future prompt A/B tests without adding a big observability stack.

### 4.6 Split operational settings from code

`03_GENERALIZATION_NOTES.md` is right that NGU-specific strings should become settings. I would start with the smallest practical settings model:

- `company_name`
- `business_description`
- `default_city`
- `default_state`
- `trades_performed`
- `proposal_signature`
- `brand_primary`
- `brand_accent`

Even if the app remains NGU-only, this makes prompts and UI easier to tune without redeploying.

---

## 5. Suggested next implementation order

1. Patch immediate security: remove self-role update, require auth in public API routes, stop service-role reads/writes unless explicitly needed.
2. Add `workspaces`/`workspace_members`, backfill NGU data, scope RLS and inserts.
3. Fix workflow correctness paper cuts: print client component, dashboard quick links, missing CRM routes/buttons, env example.
4. Make bid IDs and Gmail dedupe transaction-safe/workspace-safe.
5. Make estimate generation document-aware and assumption-aware.
6. Extract prompt/config settings so Stage 2 generalization starts paying rent immediately.

---

## 6. Final note

The app does not need a rewrite. The important move is to stop thinking of security, tenancy, roles, and activity logging as separate chores. They are one foundation: every action should know **who did it**, **which workspace it belongs to**, **what changed**, and **whether the user was allowed to do it**. Once that is true, the existing product can grow in a much calmer way.

