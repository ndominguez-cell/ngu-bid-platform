# 04 — Cursor Debug Findings (2026-05-27)

> **Audience:** Nick + partner + any assistant planning fixes.
> **Author:** Cursor (debug pass requested by Nick), 2026-05-27.
> **Scope:** Reviewed `00`–`03` notes first, then audited the repo for additional reproducible bugs. This is read-only analysis; no app files changed.

---

## 1) Critical: Public unauthenticated API access with service-role DB client

**What happens**
- `middleware.ts` explicitly treats all `/api/*` as public routes.
- Multiple API handlers use `createServiceClient()` directly and do **not** verify `supabase.auth.getUser()`.
- Result: anonymous callers can read/modify core data through API endpoints.

**Evidence**
- `middleware.ts` marks `/api/` public via `path.startsWith('/api/')`.
- `app/api/bids/route.ts`: `GET` + `POST` with `createServiceClient()` and no auth check.
- `app/api/bids/[id]/route.ts`: `GET` + `PATCH` + `DELETE` with `createServiceClient()` and no auth check.
- `app/api/estimates/route.ts` and `app/api/proposals/draft/route.ts` also create records via service role without user validation.

**Impact**
- Full read/write exposure of bid data from the public internet (not only cross-tenant, but potentially unauthenticated).

---

## 2) Critical: Tenant isolation bug is real and confirmed

This validates Claude's `02_TENANT_ISOLATION_BUG.md`.

**What happens**
- No workspace/tenant key exists on domain tables.
- RLS policy is effectively allow-all for authenticated users.
- Many data reads are unscoped (`select('*')`) and some bypass RLS with service role.

**Evidence**
- `lib/supabase/schema.sql`: no `workspace_id` columns on domain tables.
- Same file: `create policy "Authenticated full access" ... using (true) with check (true)` across core tables.
- Pages and routes query broad sets (e.g., `app/(app)/bids/page.tsx`, `app/(app)/dashboard/page.tsx`, `app/(app)/analytics/page.tsx`).

**Impact**
- Any signed-in user can access another business's data.

---

## 3) High: OAuth callback trust bug (`state` not validated server-side)

**What happens**
- Google OAuth `state` is set to raw `user.id`.
- Callback trusts `state` as `userId` and updates that profile's Gmail tokens via service role.
- Callback does not verify active authenticated session matches `state`, and no nonce/session-bound CSRF verification exists.

**Evidence**
- `app/api/auth/google/route.ts`: `state: user.id`.
- `app/api/auth/google/callback/route.ts`: `const userId = searchParams.get('state')` then updates `profiles` for `userId`.

**Impact**
- Account-linking confusion / token misbinding risk (wrong profile may receive tokens if callback params are manipulated or replayed under edge cases).

---

## 4) High: Gmail sync upserts rely on missing unique constraints

**What happens**
- Gmail sync uses `upsert(..., { onConflict: 'name' })` for `companies` and `upsert(..., { onConflict: 'email' })` for `contacts`.
- Schema does not define unique constraints/indexes on `companies.name` or `contacts.email`.

**Evidence**
- `app/api/gmail/sync/route.ts`: upserts on `name` and `email`.
- `lib/supabase/schema.sql`: `companies` and `contacts` table definitions have no unique constraints for those fields.

**Impact**
- Upsert may fail at runtime with Postgres conflict-target errors, causing sync instability/failures.

---

## 5) Medium: Broken CRM links to routes that do not exist

**What happens**
- CRM page links to add/view company/contact routes that are not present in repo.

**Evidence**
- `app/(app)/crm/page.tsx` links to:
  - `/crm/companies/new`
  - `/crm/contacts/new`
  - `/crm/companies/${id}`
- Only CRM routes present are:
  - `app/(app)/crm/page.tsx`
  - `app/(app)/crm/[id]/page.tsx`
  - `app/(app)/crm/GmailSyncButton.tsx`

**Impact**
- User-facing 404s from primary CRM actions.

---

## 6) Medium: Bid ID generator has race condition

**What happens**
- `nextBidId()` reads latest `BID-YYYY-NNN` then increments in app code.
- Parallel creates can compute same next ID before insert.

**Evidence**
- `app/api/gmail/detect-bids/route.ts`: `nextBidId()` does read-max then insert.

**Impact**
- Intermittent duplicate-key insert failures under concurrency.

---

## 7) Additional notes matching prior docs

- Claude's note that estimate AI currently uses filenames (not PDF contents) is accurate (`app/api/estimates/route.ts`).
- Tenant/workspace architecture direction in `02` remains the right long-term fix path.

---

## Suggested fix order (security-first)

1. Lock down `/api/*` immediately (auth checks + stop using service-role where request-scoped client is sufficient).
2. Patch tenant isolation (`workspace_id` + membership + RLS rewrite + scoped inserts/queries).
3. Fix OAuth state validation (nonce/state store + session verification in callback).
4. Add required unique constraints for Gmail sync upserts.
5. Repair broken CRM links/routes.
6. Move bid ID generation to DB-side atomic sequence strategy (or transaction-safe allocator per workspace).

---

*End of debug findings.*
