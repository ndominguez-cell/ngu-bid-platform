# 03 — Generalization Notes

> **Audience:** anyone planning the Stage 2 "find the template" pass from [`00_SCOPE_AND_GOALS.md`](./00_SCOPE_AND_GOALS.md).
> **Author:** Claude (Cowork), at Nick Dominguez's direction, 2026-05-27.
> **Status:** first-pass inventory of what's NGU-specific in the current code. Not a refactor plan, just a map.

---

## 1. The question

For every NGU-specific string, list, address, signature block, or assumption in the codebase: **does it need to stay specific, become per-workspace config, or generalize across all workspaces?** This note is the first pass at answering that.

The taxonomy used below:

- **NGU-only** — only ever applies to NGU. Should be deleted or moved out of the codebase entirely when other tenants exist.
- **Per-workspace config** — every tenant will have their own version. Should live in the `workspaces` table (or a sibling `workspace_settings` table) and be read at request time.
- **Already general** — works for any tenant as-is. No change needed.
- **Vertical config** — varies by industry (construction, HVAC, dropshipping). Should live at a higher level than per-workspace — e.g., a `verticals` table with default trades, default prompts, default search ladders that each workspace inherits and can override.

---

## 2. The inventory

### 2.1 Branding & identity

| Thing | Where | Category | Notes |
|---|---|---|---|
| "NGU" logo block in sidebar | `components/layout/Sidebar.tsx` | Per-workspace | Each workspace uploads a logo or short name. |
| Brand colors `#0d2137` / `#e87722` | `Sidebar.tsx`, `tailwind.config.ts` (likely), various pages | Per-workspace | Store as two hex strings in `workspaces`; inject via CSS variables. |
| "NGU Construction" text in subtitle | `Sidebar.tsx` | Per-workspace | `workspaces.name`. |
| Title bar / page titles referencing NGU | `app/layout.tsx`, individual `<title>`s | Per-workspace | Read from active workspace. |
| Favicon | `public/` (if present) | Per-workspace | Out of scope for v1 of the refactor; default favicon is fine. |

### 2.2 Domain knowledge — what NGU does

| Thing | Where | Category | Notes |
|---|---|---|---|
| Trade list: "Concrete, Earthwork, Asphalt/Paving, Drainage, Utilities, Masonry, Structural Steel, Striping, Sitework" | `app/api/estimates/route.ts` prompt | Per-workspace | Store as `workspaces.trades_performed text[]`; inject into the estimate prompt at request time. |
| "Texas site work and concrete subcontractor" persona | `app/api/estimates/route.ts`, `app/api/proposals/draft/route.ts`, `app/api/bids/[id]/find-plans/route.ts` system prompts | Per-workspace | Store as `workspaces.business_description text`. |
| "San Antonio, Texas" geography | `app/api/bids/[id]/find-plans/route.ts` | Per-workspace | Store as `workspaces.{city, state, region}`. Used to bias plan-finder search ladders to the right municipality. |
| "Current Texas market rates (2025-2026)" | `app/api/estimates/route.ts` | Per-workspace + vertical | The phrase "current market rates" is generalizable; "Texas" comes from workspace geography. A vertical-level seed of unit rates per trade would be a nice-to-have but not required at Stage 3. |
| Default `state = 'TX'` on `companies`, `bids` | `lib/supabase/schema.sql` | Per-workspace | Default should come from the workspace's `state`. |

### 2.3 Plan-finder search ladder

`app/api/bids/[id]/find-plans/route.ts` system prompt:

| Thing | Category | Notes |
|---|---|---|
| The 5-tier search ladder structure | Already general | Works for any procurement search. Keep as-is. |
| Verification rule (two-anchor confirmation) | Already general | Sound for any domain. |
| "Do NOT bypass paywalls or authentication" | Already general | Keep. |
| Texas-specific sources: `txsmartbuy.gov`, `txdot.gov` | Per-workspace + vertical | Each workspace's state surfaces different `.gov` portals; each vertical surfaces different national portals. Construction: PlanHub, BidSync, QuestCDN. HVAC permits: state contractor boards. Dropshipping: SAM.gov. |
| "Texas public projects" framing | Per-workspace | Read from workspace state. |

The cleanest way to generalize this prompt: split the system prompt into a constant scaffold (the 5-tier ladder, verification, no-paywall rules) and a templated section that gets filled per workspace: `{vertical_name}`, `{state_portals}`, `{national_portals}`, `{document_types}`. About 30 lines of code to do well.

### 2.4 Proposal email contents

`app/api/proposals/draft/route.ts`:

| Thing | Category | Notes |
|---|---|---|
| "NGU Construction, a Texas site work and concrete subcontractor" framing | Per-workspace | From `workspaces.business_description`. |
| Hardcoded signature: "Nick Dominguez, NGU Construction, ndominguez@nguconstruction.com" | Per-workspace | Belongs in `profiles.signature_block` (per-user) or `workspaces.default_signature` (per-workspace fallback). |
| "bonded, licensed, Texas experience" qualifications | Per-workspace | Store as `workspaces.qualifications_text` — free-form text the workspace owner edits in Settings. |
| Email structure (subject, greeting, scope, total, qualifications, CTA, signature) | Already general | Keep as-is. |
| "claude-sonnet-4-6" model choice | Already general | Keep. |

### 2.5 Gmail bid detection

`app/api/gmail/detect-bids/route.ts`:

| Thing | Category | Notes |
|---|---|---|
| Keyword query: `bid OR "invitation to bid" OR RFP OR RFQ OR ...` | Vertical config | Different verticals trigger on different language. HVAC: "service quote", "system replacement". Dropshipping: "wholesale inquiry". Make this a per-vertical default that workspaces can override. |
| "NGU Construction (a site work and paving company in Texas)" prompt framing | Per-workspace | From workspace settings. |
| "PlanHub or Procore or Novel or Direct or Gmail" source enum | Vertical config | Each vertical has its own bid-source ecosystem. |
| `BID-YYYY-NNN` ID format | Per-workspace | Format itself is general; the number sequence should reset per workspace (see `02_TENANT_ISOLATION_BUG.md` §6). |

### 2.6 Status enums and pipeline

`lib/types.ts` / `lib/supabase/schema.sql`:

| Thing | Category | Notes |
|---|---|---|
| `BidStatus`: New, Reviewing, Active, Submitted, Won, Lost, Declined, Expired | Vertical config | Universal across "you bid on stuff" workflows. Slight variants per vertical (HVAC might have "Quote Sent" instead of "Submitted") but the shape is right. |
| `EstimateStatus`: Draft, In Review, Approved, Submitted, Archived | Already general | Universal. |
| `ProposalStatus`: Draft, Reviewed, Sent, Declined | Already general | Universal. |
| `CompanyType`: GC, Owner, Architect, Engineer, Subcontractor, Other | Vertical config | Construction-specific. Other verticals have totally different counterparty roles. |
| `DocumentType`: plans, specs, addendum, proposal, estimate, other | Vertical config | "plans" and "specs" and "addendum" are construction language. Other verticals have product datasheets, regulatory cert PDFs, etc. |
| `UserRole`: admin, estimator, viewer | Already general | Useful in any workspace. "Estimator" is mildly construction-tinted as a label but the *function* (can create/edit bids) is universal. |

### 2.7 What's already general

Worth naming explicitly so it stays general:

- The Next.js App Router structure.
- Supabase Auth integration (`middleware.ts`, login/signup pages).
- The Gmail OAuth flow (`app/api/auth/google/`, `lib/gmail.ts`).
- Supabase Storage for documents with presigned-URL direct upload.
- Realtime notifications via Supabase channels.
- The JSON-extraction defensive pattern in every AI route (`try { JSON.parse(match[0]) } catch { fallback }`).
- The multi-turn tool-use loop pattern in the plan-finder route (handles `tool_use` + `pause_turn` stop reasons).
- `vercel.json` function-timeout configuration pattern.
- The `documents` Supabase Storage bucket.
- The activity-log table pattern (`bid_activity`).

---

## 3. Suggested schema additions for the generalization

Beyond what `02_TENANT_ISOLATION_BUG.md` already proposes:

```sql
-- Per-workspace configurable identity & behavior
alter table workspaces add column business_description text;
alter table workspaces add column trades_performed text[] default '{}';
alter table workspaces add column qualifications_text text;
alter table workspaces add column brand_primary_color text default '#0d2137';
alter table workspaces add column brand_accent_color text default '#e87722';
alter table workspaces add column logo_storage_path text;
alter table workspaces add column default_state text default 'TX';
alter table workspaces add column default_city text;
alter table workspaces add column vertical_id uuid;  -- FK to verticals once that exists

-- Per-user signature, since it's the user signing, not the workspace
alter table profiles add column signature_block text;
```

A separate `verticals` table is a Stage 4 concern — for Stage 3 (construction-only multi-tenant) the above is enough. When Stage 4 starts, lift the `trades_performed` defaults and the plan-finder regional source list into `verticals` and let workspaces inherit + override.

---

## 3b. Cross-reference: this inventory is consistent with the market scan

Codex's market research in [`07_MARKET_RESEARCH_PRODUCT_IDEAS.md`](./07_MARKET_RESEARCH_PRODUCT_IDEAS.md) §4 lists the practical settings model that comparable products (TopBuilder, iDeal, Streak, Salesflare, Airtable, monday) actually expose to their customers:

```
company_name, business_description, default_city, default_state,
trades_performed, proposal_signature, brand_primary, brand_accent
```

That's a one-for-one match with the workspace columns in §3 of this note, which is a good sign — the generalization direction is consistent with how the market shapes per-tenant config. Codex `07` §3 Priority 2 also adds default markup ranges, source list, and prompt settings to that list, which are worth folding in.

## 4. The AI prompts: a small refactor that pays off twice

Right now every AI route inlines its system prompt as a string literal. Two payoffs from moving them out:

1. **Generalization becomes a template-render step** rather than a string find-and-replace. `prompts/estimate.txt` with `{{business_description}}` and `{{trades_performed}}` placeholders, rendered at request time from workspace settings. The Aios-Missioncontrol repo's `prompts/` folder already does this; same pattern transfers.
2. **Prompt versioning and A/B testing become possible.** Stage 3+ when there's enough volume, you can run two versions of the estimate prompt against the same uploaded PDFs and compare line-item quality. Hard to do when prompts live in source files.

The cheap version of this is just `lib/prompts/estimate.ts` exporting a function that takes workspace settings and returns the prompt string. Doesn't require a templating engine. About a day's work to extract all four AI route prompts this way.

---

## 4b. A request-context helper unblocks both security and generalization

Codex `06` §4.1 sketches a `requireUserContext()` helper that every API route would use to get `{ user, supabase, serviceClient, activeWorkspaceId, role }`. That helper is the right *first* refactor before any of the prompt/config work in §4 above:

- It's the practical fix for §7.1 / §7.8 of [`01_REPO_AUDIT.md`](./01_REPO_AUDIT.md) (the public-API exposure).
- It's the natural place to read `workspace_settings` once they exist, so the AI route prompts can be templated against per-workspace values without each route inventing its own settings-fetch pattern.
- It centralizes the role-check that should gate `/api/team` and any future admin-only endpoints, which is what closes the self-role-escalation issue from `05`.

Build the helper first, then run the prompt-extraction pass in §4 — at that point both touch the same surface and the work compounds.

## 5. What this enables for Stage 3+ analytics

Per `00_SCOPE_AND_GOALS.md` §3, the aggregate-data flywheel needs:

- **Outcomes attached to estimates.** Already true — `bids.status` + `bids.our_bid_amount` + `bids.awarded_amount` give win/loss + price delta. Add an `estimate_id` reference back from the bid (or rely on the reverse `estimates.bid_id` join) so you can correlate "estimate suggested $X with this markup" to "bid was won at $Y."
- **Time-stamped status transitions.** `bid_activity` already captures status changes. As long as a row is written on every status change, the time-to-submit and time-to-decision metrics fall out of the data for free.
- **Aggregation that respects tenant boundaries.** Cross-tenant insights are *only* allowed to aggregate (counts, averages, percentiles) — never to reveal one tenant's data to another. The RLS work in `02` enforces this at the database; the analytics queries that *do* aggregate across tenants should run via the service-role client in a clearly-named module so the boundary is obvious in code review.

None of this requires changes now. It's worth being aware of as the multi-tenant refactor lands so we don't accidentally remove a column or trigger that the Stage 3+ analytics will need.

---

*Drafted 2026-05-27 by Claude (Cowork). Light update 2026-05-27 after Cursor (`04`, `05`) and Codex (`06`, `07`) review — added §3b cross-referencing the market-scan settings model, §4b on `requireUserContext()` as the prerequisite refactor. Update as the inventory shifts during the actual Stage 2 read-through.*
