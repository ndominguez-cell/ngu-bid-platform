# NGU Bid Platform — Session Handoff

**Date:** 2026-06-04  
**Branch:** `claude/amazing-darwin-Fiisg` (merged to `main`)  
**Deployment:** `dpl_CCoqnbyh4k8qxpko75uMuENSvasY` — **READY** on production (`ngu-bid-platform.vercel.app`)

---

## What Was Fixed: MIDDLEWARE_INVOCATION_FAILED (500 on every request)

### Root Cause (took several rounds to find)

Next.js 14.2.x compiles the Edge middleware bundle with `node:async_hooks` listed as a webpack **external**:

```js
// in the compiled .next/server/middleware.js
67: e => { e.exports = require("node:async_hooks") }
```

Vercel's Edge bundler resolves that external by pulling in the **real Node.js `async_hooks` source**, which internally references `__dirname`. Since `__dirname` is undefined in the Edge runtime (V8 isolate, no Node.js globals), every request throws:

```
ReferenceError: __dirname is not defined
→ 500 MIDDLEWARE_INVOCATION_FAILED
```

### Why Earlier Fixes Didn't Work

| Attempt | What we tried | Why it failed |
|---|---|---|
| Fix 1 | Null-guard on missing `SUPABASE_ANON_KEY` | Wrong diagnosis — env var wasn't the issue |
| Fix 2 | Try-catch around Supabase auth call | `__dirname` throws at module load time, before try-catch |
| Fix 3 | Removed `@supabase/ssr` from middleware entirely | Correct partial fix — cut bundle 82 kB → 26.6 kB, but `node:async_hooks` (used by Next.js's own instrumentation hook) still remained |

### The Actual Fix (`next.config.mjs`)

For `nextRuntime === 'edge'`, replace the `"commonjs node:async_hooks"` entry in webpack's externals with a `"var (expr)"` that evaluates to an inline object backed by `globalThis.AsyncLocalStorage` (which IS available in Vercel Edge):

```js
webpack: (config, { nextRuntime }) => {
  if (nextRuntime === 'edge') {
    if (Array.isArray(config.externals)) {
      config.externals = config.externals.map((ext) => {
        if (ext && typeof ext === 'object' && !Array.isArray(ext) && typeof ext.then === 'undefined') {
          const patched = { ...ext };
          const edgeShim =
            'var ({"AsyncLocalStorage":globalThis.AsyncLocalStorage,' +
            '"AsyncResource":globalThis.AsyncResource,' +
            '"createHook":function(){return{enable:function(){},disable:function(){}}},' +
            '"executionAsyncId":function(){return 0},' +
            '"triggerAsyncId":function(){return 0}})';
          if ('node:async_hooks' in patched) patched['node:async_hooks'] = edgeShim;
          if ('async_hooks' in patched) patched['async_hooks'] = edgeShim;
          return patched;
        }
        return ext;
      });
    }
  }
  return config;
},
```

**Result:** `require("node:async_hooks")` is completely eliminated from the compiled middleware bundle. Zero `__dirname` references. Middleware bundle stays at ~26.6 kB.

---

## What Else Was Done (Earlier in Session)

### Design System Migration
All 11 pages/components migrated to OKLCH CSS variables — no more hardcoded `#1a3a5c`, `#e87722`, `bg-gray-*`, or `bg-white rounded-xl shadow-sm`. Uses:
- `--navy`, `--orange`, `--surface`, `--surface-2`, `--surface-3`
- `--border`, `--border-strong`, `--text`, `--text-muted`, `--text-subtle`
- `--ok/--warn/--bad/--info` with `-soft` variants
- `.card`, `.btn`, `.btn-primary`, `.btn-accent`, `.btn-ghost`, `.btn-sm`, `.label-mono`

### New API Routes
- `GET /api/estimates/[id]/csv` — downloads line items as CSV with subtotal/markup/grand total rows
- `POST /api/estimates/[id]/reanalyze` — accepts `{storage_paths, file_names}`, runs Claude on new plan files, merges line items into existing estimate without losing prior work
- `export const maxDuration = 60` on AI routes

### New Client Components
- `app/(app)/estimates/[id]/EstimateUploadButton.tsx` — presign → direct Supabase upload → reanalyze flow with progress display
- `app/(app)/proposals/[id]/ProposalRedraftButton.tsx` — calls `POST /api/proposals/draft`, navigates to new proposal

### Database Schema
`supabase/migrations/20260101000000_initial_schema.sql` — complete idempotent schema:
- 9 tables: `bids`, `bid_activity`, `companies`, `contacts`, `documents`, `estimates`, `proposals`, `conversations`, `profiles`
- RLS policies (authenticated full access)
- `updated_at` triggers
- Storage bucket `documents` (private, 100 MB limit, PDF/image MIME types)

---

## Still Needed Before App Is Usable

The app will render a login page but all features requiring DB/AI will fail until these are configured in Vercel:

| Variable | Where to get it | Status |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → Settings → API → "anon public" | **MISSING** |
| `ANTHROPIC_API_KEY` | console.anthropic.com/settings/keys | **MISSING** |
| `GOOGLE_CLIENT_ID` | Google Cloud Console → APIs & Services → Credentials | Optional |
| `GOOGLE_CLIENT_SECRET` | Same | Optional |

**After adding env vars:**
1. Trigger a redeploy in Vercel (or it will auto-deploy on next push)
2. Run the schema SQL in Supabase SQL Editor (file: `supabase/migrations/20260101000000_initial_schema.sql`)
3. Create an account at the app URL
4. Seed test data: `POST https://ngu-bid-platform.vercel.app/api/seed` with body `{"secret":"ngu-seed-2026"}`

---

## Key Files

```
middleware.ts                          ← Edge auth routing (cookie check only, no @supabase/ssr)
next.config.mjs                        ← async_hooks Edge shim (the critical fix)
lib/supabase/server.ts                 ← createClient() / createServiceClient()
supabase/migrations/                   ← Full DB schema
app/api/estimates/[id]/csv/route.ts    ← CSV export
app/api/estimates/[id]/reanalyze/      ← AI re-analysis
app/api/proposals/draft/               ← AI proposal generation
app/(app)/estimates/[id]/              ← Estimate detail + EstimateUploadButton
app/(app)/proposals/[id]/              ← Proposal detail + ProposalRedraftButton
```

---

## Commit History (this session)

```
1fc06f8  Fix MIDDLEWARE_INVOCATION_FAILED: shim node:async_hooks for Edge runtime
f472d6d  Fix middleware: remove @supabase/ssr to eliminate __dirname Edge crash
c90bfba  Wrap middleware in try-catch to prevent MIDDLEWARE_INVOCATION_FAILED
71f3ac2  Fix middleware crash when SUPABASE_ANON_KEY env var is not set
9559446  Add supabase/migrations with complete idempotent schema
fa6291c  Implement missing features: CSV export, plan re-upload, proposal re-draft
355b7ab  Design system pass 3: migrate all remaining pages to CSS variables
```
