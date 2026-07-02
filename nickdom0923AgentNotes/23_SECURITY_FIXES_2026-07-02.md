# 23 — Security fixes for the note-21 findings (2026-07-02)

Applied on branch `claude/security-items-review-hh13hl` (PR #4). Addresses the
findings in `21_SECURITY_REVIEW_2026-07-02.md`. Two SQL migrations must be run
in Supabase (SQL Editor → Run All):
- `20260702130000_security_followups.sql` (H1 profiles grants, L6 proposal status)
- `20260702120000_estimate_takeoff.sql` (takeoff column, from the estimator work)

## Fixed

### H1 — teammates could read each other's Google tokens
`20260702130000_security_followups.sql`: `revoke select on profiles from
authenticated` and re-`grant select` on only the non-sensitive columns
(`id, full_name, title, avatar_url, role, gmail_synced_at, created_at,
updated_at`). `google_refresh_token` / `google_access_token` /
`google_token_expiry` are no longer readable by the anon/authenticated role; the
service role (API routes, OAuth callback, `lib/gmail`) is unaffected.

### H2 — untrusted email/LLM content → outbound trust / stored links
New `lib/validation.ts` (`safeHttpUrl`, `isValidEmail`, `cleanString`), applied:
- `detect-bids`: `gc_email` validated, `plans_link` restricted to http(s) before insert.
- `find-plans` auto-save: `plans_url` from the model/web search run through `safeHttpUrl`.
- `bids` POST/PATCH: `gc_email` and `plans_link` validated.
- `proposals/send`: recipient must pass `isValidEmail` before we send bid amounts to it.
- Render side (defense-in-depth for existing rows): `safeHttpUrl` guards the
  `plans_link` hrefs on the bid list and detail pages, so a legacy `javascript:`
  URL can't render as a clickable link.

### M1 — mass assignment on bids create/update
`lib/bids.ts` `pickBidFields` (explicit allowlist — no more `{...body}`, so `id`,
`workspace_id`, `created_at` can't be set by the client) + `validateBidRefs`
(rejects `company_id`/`contact_id` that aren't in the caller's workspace). Used
by both `bids` POST and `[id]` PATCH.

### M2 — roles now enforced; team routes use the workspace role
- `lib/auth.ts`: `forbidNonWriter` (blocks `viewer`) and `forbidNonAdmin`
  (owner/admin only), keyed on `workspace_members.role` (`auth.role`), not the
  global `profiles.role`.
- Writer guard added to every mutating route: bids POST/PATCH/DELETE, estimates
  POST/PATCH, reanalyze, presign, proposals draft/send, find-plans.
- `team` GET/PATCH now gate on the workspace admin role (fixes admin-in-one-
  workspace = admin-everywhere), refuse to demote the owner, and keep
  `workspace_members.role` (the enforced authority) in sync with `profiles.role`
  (what the UI reads).

### M3 — CSV formula injection
`estimates/[id]/csv`: values starting with `= + - @ TAB CR` are prefixed with `'`.

### M4 — seed endpoint
Secret is body-only now (no query param → no log/proxy/history leak) and compared
with `crypto.timingSafeEqual`.

### L1 — presign path
`bidId` sanitized and length-capped (can't inject extra path segments),
`filename` type-checked, writer guard added.

### L2 — security headers
`next.config.mjs` `headers()`: `X-Frame-Options: DENY`,
`X-Content-Type-Options: nosniff`, `Referrer-Policy`, HSTS, `Permissions-Policy`.

### L3 — dropped unused `gmail.modify` OAuth scope
`auth/google`: request only `gmail.readonly` + `gmail.send`.

### L4 — dedup checks failed open into duplicates
`gmail/sync` and `gmail/detect-bids`: `.single()` → `.limit(1).maybeSingle()`.

### L6 — proposal double-send race
`proposals/send`: atomically claims the proposal (`status → 'Sending'` only when
not already Sent/Sending) before calling Gmail, reverts to the prior status on
failure. Needs the new `'Sending'` value in the proposals status constraint
(in the migration); if the migration isn't applied the code falls back to the
old non-atomic guard instead of blocking sends.

## M5 — rate limiting / cost controls (RESOLVED)
Added `lib/ratelimit.ts` (`enforceRateLimit`) backed by a new `ai_rate_limits`
table (migration `20260702140000_ai_rate_limits.sql`, service-role only). It's a
per-user, per-route sliding window: each route passes a burst rule (debounce
double-clicks) + a sustained hourly cap. Fails OPEN if the table is missing so it
never breaks the product before the migration is applied. Wired into every AI
route:
- estimates create / reanalyze / find-plans → `heavyAI` (1 per 8s, 15/hour)
- gmail detect-bids / sync → `gmailScan` (1 per 15s, 12/hour) + writer guard added
- proposal draft → `lightAI` (1 per 4s, 40/hour)
- proposal send → `send` (1 per 3s, 80/hour)
Returns 429 with a `Retry-After` header when exceeded. Tune the presets in
`lib/ratelimit.ts` if the caps are too tight/loose for real usage.

## Deferred (larger scope, noted for follow-up)
- M6 — team listing still pages only the first 50 project users via
  `auth.admin.listUsers()`; fine until >50 users, then needs pagination.
- L5 — `nextBidId` race / lexicographic sort past BID-YYYY-1000 (use a sequence).
- Token encryption at rest (H1 note) — pgsodium/Vault, eventual hardening.
