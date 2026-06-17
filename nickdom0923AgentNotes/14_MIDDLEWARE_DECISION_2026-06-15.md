# 14 — Middleware Decision (2026-06-15)

**Decision:** `middleware.ts` is intentionally absent. **Do not restore it without a green Vercel preview deployment first.**

## Why

- The repo's history shows three escalating attempts to fix `MIDDLEWARE_INVOCATION_FAILED` on Vercel Edge, ending in commit `4868a80 Delete middleware.ts`. The deleted state is the **known-safe** state.
- Authorization is enforced at the route level via `requireUser()` in [lib/auth.ts](../lib/auth.ts). Every service-role API route calls it; that is the auth boundary, not the middleware.
- Cursor's review (see `11_CURSOR_A3_REVIEW.md`, "High" finding on `middleware.ts:1,19-44`) explicitly says: *"Leave middleware deleted while API routes and the app layout perform real auth. If global middleware is still desired, validate a preview deployment and compiled Edge bundle first, keep a narrow matcher, and retain route-level `requireUser()` as the authorization boundary."*
- An untracked `middleware.ts` was found on disk on 2026-06-15 (re-importing `@supabase/ssr`, with the broad matcher that originally crashed). It was deleted without commit because reintroducing it would have re-created the Edge crash on the next push.

## If a future session feels the urge to add it back

Don't, unless **all** of the following are true:

1. There is a specific, named gap that route-level `requireUser()` cannot cover.
2. A preview deploy is built and the compiled `.next/server/middleware.js` shows no `require("node:async_hooks")` and no `__dirname` references.
3. The matcher is **narrow** (path-prefix list), not the catch-all from HANDOFF.md:64.
4. Route-level `requireUser()` is retained as defense in depth.

## What this leaves on the merge-blocker list

This commit only documents the decision; it does not address the actual A3 blockers. Those (per `11_CURSOR_A3_REVIEW.md` + `12_CODEX_A3_REVIEW_AND_STRUCTURE.md`):

- Migration auto-enrolls every existing profile into NGU workspace (needs explicit allowlist).
- Bid ID collisions across workspaces (needs UUID PK + per-workspace display number).
- Cross-workspace foreign-key injection on estimate/proposal inserts.
- Role authority split between `profiles.role` and `workspace_members.role`.
- Expand/backfill/contract migration rollout ordering.

Closing those is the work before `feature/a3-tenant-scoping` merges to `main`.

*-- Claude (Code), at Nick's direction. --*
