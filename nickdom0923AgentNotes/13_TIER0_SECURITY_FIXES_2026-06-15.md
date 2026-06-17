# 13 — Tier-0 Security Fixes (2026-06-15)

**Author:** Claude (Cowork), at Nick's direction.
**Branch:** `feature/a3-tenant-scoping`.
**Source:** the three "fix even with one customer" items from the A3 review
(`11_CURSOR_A3_REVIEW.md` + `12_CODEX_A3_REVIEW_AND_STRUCTURE.md`), verified
against the schema before fixing.

These are internet-facing holes that exist independent of multi-tenancy, so they
should land on the branch **before it merges to the live site**.

## What changed

**1. Storage RLS is now workspace-scoped** — `supabase/migrations/20260615120000_security_tier0.sql`
The private `documents` bucket previously let *any* authenticated user read or
delete *any* object (`docs_upload/read/delete` only checked `bucket_id`). The
presign route already namespaces uploads under `${workspace_id}/...`; the new
`docs_workspace_member` policy enforces that the first path segment is a
workspace the caller belongs to (via `is_workspace_member()`), for select /
insert / update / delete. A `safe_uuid()` helper makes the path→uuid cast
NULL-on-failure so a bad path can't break the policy.

**2. Signup can no longer self-grant a role** — same migration
`handle_new_user()` used to copy `raw_user_meta_data->>'role'` into
`profiles.role`, so anyone could sign up as `admin`. It now always creates the
profile with the least-privileged role and ignores client metadata. Real
authority belongs in `workspace_members.role` (assigned by invite/membership
logic, Tier 1).

**3. Google OAuth is CSRF-safe** — `app/api/auth/google/route.ts` + `.../callback/route.ts`
The flow used the raw user UUID as the OAuth `state` on a public callback, so a
forged callback could write Google tokens onto another user's profile. Now the
initiator generates a random single-use `state` in an HttpOnly cookie; the
callback (a) derives the target user from the caller's own Supabase session, not
the URL, and (b) requires the echoed `state` to match the cookie before writing
tokens. The cookie is consumed on every exit path.

## Apply order

1. Ensure `20260612100000_tenant_scoping.sql` has already been run (this
   migration depends on `is_workspace_member()` / `workspace_members`).
2. Run `20260615120000_security_tier0.sql` in the Supabase SQL Editor.
3. Deploy the code (the two Google routes). No env-var or Google-console changes
   needed — the redirect URI is unchanged.

## Behavior changes to know about

- **New signups now default to `viewer`** (was `estimator`) and get no workspace
  access until added to `workspace_members`. Promote real teammates explicitly.
- **Legacy storage objects** uploaded before the workspace-prefix change have a
  non-UUID first path segment and will no longer be reachable by the
  authenticated role (service role still can). Re-upload them or do a one-time
  storage move into `${workspace_id}/...`. The sandbox typically has none.

## Still open (Tier 1, before customer #2)

Not addressed here: migration auto-enroll → allowlist; bid-ID redesign (UUID PK
+ per-workspace display number, atomic allocation); validate caller-supplied
parent FKs + composite FKs; enforce viewer/estimator/owner on routes+RLS;
`requireUser` should 500 (not 403) on a membership-query error; expand/backfill/
contract migration rollout. See notes 11 and 12.
