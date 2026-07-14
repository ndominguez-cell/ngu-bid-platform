# 21 — Security Review (2026-07-02)

Full-project security review of the current `main` (post A3 tenant-scoping + tier-0 fixes).
Scope: all API routes, auth helpers, Supabase migrations/RLS, storage, Gmail/OAuth flow,
and client pages that touch security-relevant data.

**Overall:** the A3/tier-0 work landed well. Every service-role route goes through
`requireUser()` and scopes queries by `workspace_id`, the OAuth callback derives identity
from the session (not the `state` param), storage RLS is workspace-prefixed, and the signup
trigger no longer trusts client-supplied roles. The findings below are what's left, ranked.

---

## HIGH

### H1. Workspace teammates can read each other's Google OAuth tokens
`supabase/migrations/20260612100000_tenant_scoping.sql` §7:

```sql
create policy "read_same_workspace" on profiles
  for select to authenticated
  using (id = auth.uid() or shares_workspace_with(id));
```

The tier-0 work added **column-level UPDATE** grants on `profiles` but left **SELECT**
unrestricted. Any workspace member can run, from the browser console with the anon key:

```js
supabase.from('profiles').select('id, google_refresh_token, google_access_token')
```

…and pull a teammate's Gmail **refresh token** (scopes: `gmail.readonly`, `gmail.send`,
`gmail.modify`). Combined with the public `GOOGLE_CLIENT_ID`/`SECRET` (server-side, but the
token is durable), that's persistent full read/send access to a coworker's mailbox,
completely outside the app. The cross-*tenant* leak was closed; the same-*workspace* leak
was not.

**Fix (pick one, first is best):**
1. Move `google_refresh_token` / `google_access_token` / `google_token_expiry` to a separate
   table (e.g. `google_credentials`) with **RLS enabled and no policies** — service-role
   only. `lib/gmail.ts` and the OAuth callback already use the service client, so only the
   table name changes.
2. Or mirror the UPDATE fix with column-level SELECT grants:
   ```sql
   revoke select on table profiles from authenticated;
   grant select (id, full_name, title, avatar_url, role, gmail_synced_at, created_at, updated_at)
     on table profiles to authenticated;
   ```
   (Keep the `read_same_workspace` policy; the grant limits which columns it can expose.)

Also note: tokens are stored in plaintext. Acceptable at this stage, but encrypting at rest
(pgsodium / Supabase Vault) is the eventual right answer.

### H2. Untrusted email content flows into outbound trust decisions (prompt injection chain)
`app/api/gmail/detect-bids/route.ts` feeds raw inbound email text to Claude and stores the
extracted fields (`gc_email`, `plans_link`, `gc_name`, …) directly into `bids`. Two sinks
make this exploitable by anyone who can send you an email:

- **`gc_email` → proposal recipient.** `app/api/proposals/[id]/send/route.ts` sends the
  proposal (with your bid amounts) to `bids.gc_email` unconditionally. A crafted "bid
  invitation" (or a prompt-injection payload in the body that tells the extractor to use a
  different reply address) redirects your pricing to an attacker.
- **`plans_link` → rendered as `<a href>`** in `app/(app)/bids/[id]/page.tsx:92` and
  `bids/page.tsx:272` with no scheme validation. A `javascript:` or attacker-controlled URL
  from a hostile email becomes a one-click stored payload / phishing link inside your own UI.
  The same applies to `report.plans_url` auto-saved by `find-plans` (LLM + web search
  output), and to `plans_link` accepted verbatim in `POST /api/bids`.

**Fix:**
- Validate URLs server-side before storing or rendering: parse with `new URL()`, allow only
  `http:`/`https:`, reject otherwise (detect-bids insert, find-plans auto-save, bids
  POST/PATCH).
- Validate `gc_email` with an email-shape check at write time, and make the send UI show the
  recipient explicitly (it's derived from email content, so the human should confirm it —
  today the recipient isn't surfaced at send time).
- Treat all LLM-extracted fields as untrusted input generally (length caps, enum checks on
  `source`, date-shape checks) since check constraints on `bids` don't cover them.

---

## MEDIUM

### M1. Mass assignment on bids create/update
`app/api/bids/route.ts` POST and `app/api/bids/[id]/route.ts` PATCH insert/update
`{ ...body }`. `workspace_id` is correctly forced *after* the spread, but the client can
still set any other column: `id` (change a bid's primary key via PATCH), `created_at`,
`thread_id`, and notably `company_id` / `contact_id` — which are **not validated to belong
to the caller's workspace**, so a member can create dangling cross-tenant FK references.
**Fix:** allowlist the writable fields explicitly (same pattern already used in
`app/api/profile/route.ts` and `estimates/[id]`), and verify `company_id`/`contact_id`
rows match `auth.workspaceId` before writing.

### M2. Roles exist but are not enforced (and there are two competing role systems)
- `requireUser()` returns `workspace_members.role`, but **no business route checks it** —
  a `viewer` can create/delete bids, run AI estimates, and send proposals from the
  connected Gmail account.
- The admin gate in `app/api/team/route.ts` checks `profiles.role` instead — a **global**
  flag, so an admin in one workspace is an admin in every workspace they're a member of,
  and `PATCH /api/team` writes to that global column.
**Fix:** make `workspace_members.role` the single authority: gate team routes on
`auth.role === 'admin' || 'owner'`, have team PATCH update `workspace_members.role`, and
add minimal write-guards (`viewer` → read-only) on mutating routes. Drop or demote
`profiles.role` to avoid the ambiguity.

### M3. CSV formula injection in estimate export
`app/api/estimates/[id]/csv/route.ts` quotes values but doesn't neutralize leading
`=`, `+`, `-`, `@`. Line items come from LLM output and user edits; a cell like
`=WEBSERVICE(...)` or `=HYPERLINK(...)` executes when the CSV is opened in Excel.
**Fix:** in `esc()`, prefix values starting with `= + - @ \t \r` with `'`.

### M4. Seed endpoint hardening
`app/api/seed/route.ts` accepts the secret **in the query string** (ends up in Vercel
request logs, proxies, browser history) and compares with `!==` (not constant-time), with
no rate limit, so it's brute-forceable and leak-prone. It also writes with the service
role. **Fix:** body-only secret, compare with `crypto.timingSafeEqual`, and ideally remove
the route from production entirely (or additionally require an authenticated admin).

### M5. No rate limiting / cost controls on AI endpoints
`find-plans` runs up to 8 Sonnet + web-search turns per call (`maxDuration = 300`);
`detect-bids` fans out to ~30 Gmail fetches + Haiku calls. Any workspace member (including
`viewer`) can hammer these and run up the Anthropic bill; there's also no per-bid in-flight
lock, so double-clicks double-spend. **Fix:** per-user rate limit (e.g. Upstash Ratelimit or
a simple `bid_activity`-based cooldown), and a cheap "already running" guard.

### M6. Team listing breaks past 50 users
`serviceClient.auth.admin.listUsers()` in `app/api/team/route.ts` returns the first page
(50) of **all users in the Supabase project**, then filters to the workspace. Once the
project has >50 users, team members silently disappear from the admin view. **Fix:** iterate
pages, or better, query only the workspace member IDs you already have
(`auth.admin.getUserById`, or keep email on `profiles`).

---

## LOW

- **L1. `bidId` not sanitized in presign path** (`app/api/estimates/presign/route.ts`):
  `filename` is sanitized but `bidId` is interpolated raw into the storage key. It can't
  escape the workspace prefix (Supabase keys are literal, and RLS checks segment 1), but it
  allows junk/nested paths and `filename` being a non-string throws a 500. Apply the same
  `[^a-zA-Z0-9._-]` filter and type-check the body.
- **L2. Missing security headers.** No CSP, HSTS, `X-Frame-Options`/`frame-ancestors`,
  `Referrer-Policy`, or `X-Content-Type-Options` anywhere (`next.config.mjs` /
  `vercel.json`). Add a `headers()` block in `next.config.mjs`; even a report-only CSP is a
  good start given H2's link-injection surface.
- **L3. `gmail.modify` scope is requested but never used** (`app/api/auth/google/route.ts`).
  Only read + send are exercised; drop `modify` to shrink the blast radius of H1 and ease
  Google OAuth verification.
- **L4. Dedup checks use `.single()`** in `gmail/sync` and `gmail/detect-bids`: with ≥2 rows
  for a thread the call errors, `data` is null, and the "skip if exists" check fails open →
  duplicate bids/conversations. Use `.maybeSingle()` + `limit(1)`.
- **L5. `nextBidId` race + sort bug**: concurrent detect-bids runs can generate the same ID
  (PK collision → silently dropped inserts since the error isn't checked), and lexicographic
  ordering breaks at `BID-YYYY-1000`. A Postgres sequence or `on conflict` retry fixes both.
- **L6. Proposal double-send race**: status check and Gmail send in
  `proposals/[id]/send/route.ts` aren't atomic; two rapid clicks send twice. Do a
  conditional claim first (`update ... set status='Sending' where id=? and status!='Sent'`)
  and only send if a row was claimed.
- **L7. Unchecked insert errors**: several service-role inserts (`conversations`,
  `documents`, `bids` in detect-bids) ignore the returned `error`, so failures are invisible.

---

## Things that are in good shape (keep doing these)

- `requireUser()` contract + workspace scoping on every service-role query (spot-checked all
  routes: bids, estimates, proposals, gmail, team, presign — all filter by `workspace_id`).
- OAuth: random single-use `state` in an HttpOnly cookie, identity from the caller's own
  session, cookie consumed on every exit path, tokens written server-side only.
- Storage: private bucket, workspace-prefixed keys, `safe_uuid` + `is_workspace_member`
  RLS on `storage.objects`, server-issued signed upload URLs.
- Signup trigger defaults to `viewer` and ignores client metadata; profile PATCH explicitly
  excludes `role`; column-level UPDATE grants on `profiles`.
- New signups get no workspace (no data) until explicitly enrolled — correct default.
- No `.env` files tracked in git; `.gitignore` covers them; no secrets found in the repo
  (including `designrevisions.patch`).

## Suggested order of work

1. **H1** — move Google tokens out of member-readable `profiles` (small, highest payoff).
2. **H2** — URL-scheme + email validation on LLM-extracted fields; show recipient at send.
3. **M1/M2** — field allowlists + make `workspace_members.role` the enforced authority.
4. **M3–M6, L1–L7** — batch as a hardening pass.
