# 05 — Cursor Second Pass + Forward Ideas

> **Audience:** Nick + partner + future assistants.
> **Author:** Cursor, 2026-05-27.
> **Scope:** Second debugging sweep after `04`, plus practical ideas to push the app forward using the direction in `00`–`03`.

---

## A) Additional bugs found in second pass

## 1) Critical: Self-role escalation to admin

**What happens**
- Any logged-in user can update their own `profiles.role` via `/api/profile`.
- That lets a normal user promote themselves to `admin`.
- Once admin, they can call `/api/team` admin features.

**Evidence**
- `app/(app)/settings/ProfileEditor.tsx` sends `{ full_name, title, role }` to `/api/profile`.
- `app/api/profile/route.ts` PATCH writes `{ full_name, title, role }` for current user via service client with no role guard.
- `app/api/team/route.ts` trusts `profiles.role === 'admin'`.

**Impact**
- Privilege escalation by any authenticated user.

---

## 2) High: New Bid form can fail because backend does not auto-generate ID

**What happens**
- UI says Bid ID is optional and sends `id: undefined` when blank.
- DB table `bids.id` is text primary key with no default.
- API `POST /api/bids` does raw insert and does not create an ID.

**Evidence**
- `app/(app)/bids/new/page.tsx`: `id: form.id || undefined`.
- `app/api/bids/route.ts`: inserts `body` as-is.
- `lib/supabase/schema.sql`: `bids.id text primary key` (no default).

**Impact**
- “Create bid” can fail unexpectedly if user leaves ID blank.

---

## 3) Medium: Frontend offers invalid source value not accepted by DB check

**What happens**
- New bid UI includes source option `Other`.
- Extraction prompt in Gmail route and existing seeded values imply accepted values are `PlanHub/Procore/Novel/Direct/Gmail`.
- DB does not have explicit source constraint, but downstream analytics/UI assume a fixed source set; `Other` may be silently excluded and analytics become misleading.

**Evidence**
- `app/(app)/bids/new/page.tsx`: source options include `Other`.
- `app/(app)/analytics/page.tsx`: source reporting only for `PlanHub`, `Procore`, `Novel`, `Direct`, `Gmail`.

**Impact**
- Data quality drift and missing analytics coverage for user-created bids.

---

## 4) Medium: Upload route accepts images but stores all uploaded docs as PDFs

**What happens**
- Estimate upload UI accepts `.pdf,image/*`.
- During save, backend always inserts `mime_type: 'application/pdf'` and document `type: 'plans'`.

**Evidence**
- `app/(app)/estimates/new/page.tsx`: file picker `accept=".pdf,image/*"`.
- `app/api/estimates/route.ts`: document insert hardcodes `mime_type: 'application/pdf'`.

**Impact**
- Incorrect metadata in `documents`, potential confusion and downstream processing bugs.

---

## 5) Medium: API auth model is inconsistent (session checks mixed with service-role writes)

This overlaps with `04`, but second pass confirms the pattern is broad:
- some routes correctly verify user (`/api/gmail/sync`, `/api/gmail/detect-bids`),
- others use service role without user checks (`/api/bids`, `/api/bids/[id]`, `/api/estimates`, `/api/proposals/draft`, etc.).

Even after tenant isolation, this mixed pattern will remain risky unless standardized.

---

## B) Confidence check vs `00`–`03`

- `02_TENANT_ISOLATION_BUG.md` remains correct and urgent.
- `03_GENERALIZATION_NOTES.md` is directionally strong; the biggest blocker to safe generalization is still security/data isolation first.
- New finding #1 (self-role escalation) is immediate and independent of multi-tenant rollout; fix this now.

---

## C) Additional ideas to push the app forward (grounded in `00`–`03`)

The goal here is “Stage 1 value now, Stage 3-ready later,” without overbuilding.

## 1) Security hardening sprint (highest leverage)

- Standardize API pattern: always `createClient()` + `auth.getUser()` for request identity.
- Restrict `createServiceClient()` to narrowly scoped server-only operations.
- Remove `role` updates from `/api/profile`; allow role changes only in admin/team endpoint.
- Add a tiny “security smoke test” checklist:
  - unauthenticated `/api/bids` must return `401`,
  - non-admin cannot call `/api/team`,
  - user cannot self-promote role.

This directly supports Stage 1 stability and Stage 3 trust.

## 2) Workspace-ready schema seam (minimal first increment)

Before full tenant migration, add non-breaking seams:
- create `workspaces` + `workspace_members` tables,
- add nullable `workspace_id` to domain tables,
- start stamping new inserts with `workspace_id` in code paths.

This mirrors `02` rollout while minimizing risky “big bang” change.

## 3) Prompt/config extraction pass (small effort, big future payoff)

Following `03`, move hardcoded NGU strings from routes into:
- `workspace_settings` fields (business description, region, trade list, signature defaults),
- prompt builder helpers (e.g., `lib/prompts/*`).

Immediate benefit: easier tuning for NGU.
Future benefit: almost all Stage 2 generalization work already done.

## 4) Make estimate generation genuinely document-aware

As noted in `01` and validated in code:
- current estimate AI uses filenames, not file contents.

Practical path:
- extract PDF text (or use native Claude PDF/doc input),
- persist extraction output with document metadata,
- feed extracted text chunks to estimate prompt.

This is likely the single biggest quality upgrade to NGU’s day-to-day estimator workflow.

## 5) Bid quality and dedupe improvements

- Add deterministic dedupe keys in Gmail detection (thread + normalized project + due date).
- Add “possible duplicate” review UI for ops speed.
- Move bid ID allocation to DB-side atomic strategy (especially once `workspace_id` exists).

This improves reliability now and avoids painful collisions during multi-tenant growth.

## 6) Invite-based team onboarding (future-facing but near-term useful)

You mentioned the long-term vision of owners inviting employees by email. A thin version can land early:
- owner invites email,
- accepted invite creates/joins workspace membership,
- no open public self-signup into existing workspace data.

This closes current exposure patterns and aligns perfectly with `00` Stage 3 direction.

---

## D) Suggested implementation order

1. Fix self-role escalation (`/api/profile` role write path).
2. Lock down unauthenticated/overpowered API routes.
3. Implement tenant isolation migration path from `02`.
4. Fix New Bid ID generation path.
5. Add prompt/config extraction and document-aware estimate improvements.
6. Add invite flow and workspace member UX.

---

*End of second-pass note.*
