# 08 — Productization Punch-List

> **Author:** Claude (Cowork), at Nick's direction, 2026-06-09.
> **Purpose:** the concrete, file-referenced steps to take `ngu-bid-platform` from *NGU's internal tool* to *a product a second construction subcontractor can pay for.* This is a working checklist, not a vision doc — every item points at a real file.
> **Decision it serves:** construction is the path to revenue. NGU is the live reference customer and the family business, so there is no ownership friction. Sell the build/service first (income now), then turn the repeatable vertical into a multi-tenant SaaS (equity later). Nick's Aerospace background is credibility and the future forecasting moat — not the near-term product.

> ⚠️ **Staleness:** this audit was done against the local clone at commit `d34ae22` (2026-05-27). The live deploy and `origin/main` (github.com/ndominguez-cell/ngu-bid-platform) are ahead. **Pull latest before implementing** and re-confirm each file reference below still matches. The *patterns* (single-tenant, service-role bypass, hardcoded NGU) almost certainly still hold even if line numbers moved.

---

## Part A — Security (do these before a second human ever logs in)

These are exposures *today*, because the app is on the public internet even with one customer. Fix order matters.

### A1. Unauthenticated API + service-role bypass — **most severe**

`middleware.ts` marks every `/api/*` route public:

```ts
const isPublicRoute = ... || path.startsWith('/api/');
```

and routes like `app/api/bids/route.ts` use `createServiceClient()` (service-role key, bypasses all row security) with **no auth check at all**:

```ts
export async function GET() {
  const supabase = createServiceClient();
  const { data } = await supabase.from('bids').select('*') ...  // returns ALL bids to anyone
}
```

Anyone who knows the URL can read and write every bid, estimate, and contact without an account.

**Fix:** add a `requireUserContext(req)` helper (in `lib/supabase/server.ts` or a new `lib/auth.ts`) that calls `supabase.auth.getUser()`, returns 401 if absent, and returns the authenticated user + their workspace id. Every `/api/*` route calls it first. Reserve `createServiceClient()` for genuinely server-only jobs (Gmail token refresh, webhooks) — never as the default DB client for user requests.

### A2. Self-role escalation

`app/api/profile/route.ts` PATCH writes `role` straight from the request body:

```ts
const { full_name, title, role } = await req.json();
serviceClient.from('profiles').update({ full_name, title, role }).eq('id', user.id)
```

Any signed-in user can PATCH themselves to `admin`.

**Fix:** drop `role` from the writable fields on this endpoint. Role changes go through a separate admin-only path. One-line change, no architecture impact — do it today.

### A3. Tenant isolation (also the Stage-3 foundation)

There is no company/workspace scoping anywhere — `bids` GET is a bare `select('*')`. With one customer that's invisible; with two it means Company B sees Company A's bids.

**Fix:** introduce `workspace_id` (a.k.a. `company_id`) on every business table (`bids`, `estimates`, `proposals`, contacts/CRM, documents), plus `workspaces` and `workspace_members` tables. Scope every query by the caller's workspace (from A1's helper) and back it with Supabase RLS policies. **Doing A3 once is the same work as "build multi-tenant SaaS" — the bug fix and the product are the same refactor.** The architecture pattern already exists in the sibling `Aios-Missioncontrol` repo (`workspaces` + `workspace_members` + RLS, owner/manager/viewer roles) — port it, don't reinvent.

---

## Part B — The NGU-to-configurable separation (this is what makes it a *product*)

The app is sellable to a second subcontractor the moment "NGU" lives in a config row instead of in the code. The coupling is shallow and clustered — good news. Everything below should be driven by a per-workspace `settings` record.

| Hardcoded today | Where (confirmed) | Becomes config key |
|---|---|---|
| "NGU" logo text, "NGU Construction" | `app/(auth)/login/page.tsx`, `signup/page.tsx`, `estimates/[id]/print/page.tsx` | `company_name`, `logo_text` |
| Brand orange `#e87722` | `app/(app)/dashboard/page.tsx` (`border-[#e87722]`) and elsewhere | `brand_color` |
| `ndominguez@nguconstruction.com`, "Nick Dominguez at NGU Construction" signature | `estimates/[id]/print/page.tsx`, `proposals/new/page.tsx` | `reply_email`, `signature_block` |
| Trade list (Concrete, Earthwork, Asphalt/Paving, Drainage, Utilities, Masonry, Structural Steel, Striping, Sitework) | `EstimateEditor.tsx` `TRADES[]` **and** repeated inside 4 AI prompts | `trades[]` (single source of truth, injected into prompts) |
| "Texas", "San Antonio", Texas market rates | estimate + proposal + find-plans prompts, `bids/new` placeholder | `state`, `default_city`, `market_region` |
| Texas plan-room sources (txsmartbuy.gov / ESBD) | `app/api/bids/[id]/find-plans/route.ts` | `plan_sources[]` per state |

The four AI surfaces — `api/estimates/route.ts`, `api/proposals/draft/route.ts`, `api/bids/[id]/find-plans/route.ts`, `api/gmail/detect-bids/route.ts` — all open with a hardcoded "You are ... for NGU Construction, a Texas site work and concrete subcontractor" plus the trade list. **Parameterize these into one prompt-builder** that takes `{company_name, trades, state, plan_sources}` from workspace settings. This is the single highest-leverage refactor: it's what lets the same code estimate for a Georgia HVAC sub or an Ohio paving crew with zero code change.

**What stays NGU-only:** ideally nothing. After Part B, NGU is just workspace #1.

---

## Part C — Minimum to onboard customer #2

Once A + B are done, the smallest viable path to a second paying subcontractor:

1. Self-serve signup creates a `workspace` and makes the signer its owner (extends existing `signup/page.tsx`).
2. A settings page to fill the Part-B config (company name, color, trades, state, signature) — `app/(app)/settings/` already exists; add the workspace fields.
3. Connect *their* Gmail (the OAuth flow already exists at `app/api/auth/google/`).
4. Billing: start manual (Stripe payment link, invoice them) — do **not** build billing UI for customer #2. Validate willingness to pay before automating it.

That is the whole product. Everything else (the forecasting/analytics moat from the Cost Prediction work, the cross-tenant win/loss flywheel) layers on *after* there are paying tenants generating data.

---

## 90-day sequence (anchored 2026-06-09)

- **Weeks 1–2:** A2 (today), then A1 (the `requireUserContext` helper across all routes). Pull latest first. These are pure security, no product debate needed.
- **Weeks 3–5:** A3 — workspace_id + RLS, ported from the Aios pattern. NGU becomes workspace #1; verify nothing broke for the live user.
- **Weeks 6–8:** Part B — extract the config layer and the parameterized prompt-builder. Confirm NGU still produces identical estimates/proposals from config.
- **Weeks 9–11:** Part C — signup-creates-workspace, settings page, second Gmail. Dogfood by creating a fake "test sub" workspace end to end.
- **Week 12:** line up one real second subcontractor (local, warm via the family construction network) for a paid pilot. Manual Stripe link. One customer, finished — not five, started.

## The immediate next 3 actions

1. `git pull` the latest `main` so we're working against the live code, not the May snapshot.
2. Ship A2 (remove `role` from the profile PATCH) — minutes of work, closes a real hole.
3. Write the `requireUserContext` helper and apply it to the four service-role routes (A1).

I can do 2 and 3 in this workspace as soon as the repo is current — say the word and I'll pull and start.

---

*The one discipline that makes or breaks this: it must not become folder #7. One vertical (construction), one chassis (this repo), one finished second customer before anything new starts.*
