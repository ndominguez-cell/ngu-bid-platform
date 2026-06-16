# Tenant Isolation Test Suite Handoff

Date: 2026-06-16

This note captures the test/CI work added for Claude Code.

## New Files

- `.github/workflows/tenant-isolation.yml`
- `.eslintrc.json`
- `supabase/config.toml`
- `tests/tenant-isolation.test.mjs`
- `tests/README.md`
- `nickdom0923AgentNotes/20_TENANT_ISOLATION_TEST_SUITE_2026-06-16.md`

## Modified Files

- `package.json`
  - Added `typecheck`.
  - Added `test:tenant`.
- `lib/auth.ts`
  - Added a hard-gated tenant-isolation test auth path.
  - It only works when `TENANT_ISOLATION_TEST_MODE=1` and `NODE_ENV !== 'production'`.
  - It reads `x-tenant-test-user-id`, then resolves the real membership from `workspace_members` using the service client.
- `app/api/estimates/route.ts`
  - Added deterministic AI output only for `TENANT_ISOLATION_TEST_MODE=1` outside production.
- `app/api/proposals/draft/route.ts`
  - Added deterministic AI output only for `TENANT_ISOLATION_TEST_MODE=1` outside production.

## Test Runner Recommendation

Use Node's built-in `node:test`.

Reason:

- The repo has no test framework today.
- The suite can hit actual HTTP API routes with native `fetch`.
- Supabase setup/teardown uses the existing `@supabase/supabase-js` dependency.
- No Playwright browser install is needed just to test API isolation.

## What the Suite Covers

The suite creates two isolated tenants:

- Workspace A + member A.
- Workspace B + member B.

It seeds each tenant with:

- bid
- estimate
- proposal
- document metadata
- conversation

Then it asserts through actual API routes:

- A cannot list B bids.
- A cannot read B bid detail.
- A cannot update B bid.
- A cannot delete B bid.
- B has the symmetric protections against A.
- Malformed B estimates/proposals joined to an A bid do not leak through embedded service-role selects.
- Cross-workspace `bid_id` injection into estimate creation is rejected.
- Cross-workspace `estimate_id` injection into proposal drafting is rejected.
- Presign paths always start with the caller's workspace prefix.
- Two workspaces can use the same display bid number without a global primary-key collision.

It also asserts at the RLS layer, using an anon/authenticated Supabase client rather than service role:

- A can see A rows.
- A cannot select B rows.
- A cannot update B rows.
- A can upload to A's storage prefix.
- A cannot upload to B's storage prefix.

The service-role key is used only for setup, cleanup, and post-attack verification.

## CI Workflow

`.github/workflows/tenant-isolation.yml` runs:

1. `npm ci`
2. `npm run typecheck`
3. `npm run lint`
4. `supabase start`
5. `supabase db reset --local`
6. Next dev server with `TENANT_ISOLATION_TEST_MODE=1`
7. `npm run test:tenant`

The workflow uses local disposable Supabase keys from `supabase status -o env`, so no GitHub secrets are needed in this local-Supabase mode.

`supabase/config.toml` was added because the repo had migrations but no Supabase CLI project config, so `supabase start` would not otherwise have a local project definition.

If switching to a hosted Supabase CI branch DB, add these GitHub Actions secrets:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## How To Run Locally

```bash
npm ci
supabase start
supabase db reset --local
supabase status -o env > supabase.env
```

Export:

```bash
export NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
export NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY from supabase.env>
export SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY from supabase.env>
export NEXT_PUBLIC_APP_URL=http://127.0.0.1:3000
export TEST_APP_URL=http://127.0.0.1:3000
export TENANT_ISOLATION_TEST_MODE=1
export ANTHROPIC_API_KEY=tenant-isolation-tests-do-not-call-anthropic
```

Terminal 1:

```bash
npm run dev -- -H 127.0.0.1 -p 3000
```

Terminal 2:

```bash
npm run typecheck
npm run lint
npm run test:tenant
```

## Assumptions and Expected Failures Until File 17 Merges

This suite deliberately encodes known failures from notes 11/17.

Expected failures on the current branch:

- `app/api/bids/[id]/route.ts` may leak malformed cross-workspace embedded children because it uses service-role embedded selects.
- `app/api/estimates/route.ts` currently accepts raw cross-workspace `bid_id`.
- `app/api/proposals/draft/route.ts` currently accepts raw cross-workspace `estimate_id` if the scoped lookup misses.
- The bid-number collision test fails until `bids.id` becomes a UUID primary key and display numbers move to `unique(workspace_id, bid_number)`.

If the composite FK work from file 17 is already merged, malformed child-row seeding may fail. In that case the embedded-child test treats the database rejection as a pass for that attack case.

## Notes For Claude Code

Do not remove the failing assertions to make CI green. The intended path is to merge the file 17 hardening work, then let this suite become green as proof.

The test-only auth path in `lib/auth.ts` is intentionally narrow. Keep all three protections:

- `TENANT_ISOLATION_TEST_MODE=1`
- `NODE_ENV !== 'production'`
- real membership lookup from `workspace_members`
