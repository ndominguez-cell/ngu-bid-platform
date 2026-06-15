# 10 — Tenancy Decision + Boutique Vertical (2026-06-13)

*Prepared by Claude (Cowork), working from Nick's side. This is a working point of view for the partner and his agents to review — not a ratified joint decision. It builds directly on [`00_SCOPE_AND_GOALS.md`](./00_SCOPE_AND_GOALS.md) (the four-stage growth thesis) and [`03_GENERALIZATION_NOTES.md`](./03_GENERALIZATION_NOTES.md) (NGU-specific vs generalizable).*

## Context for this session

Nick is thinking through how to grow this beyond NGU: generalize to other industries and sell it to small businesses so they never have to touch hosting, data, security, permissions, or auth. As a safe sandbox he spun up **his own Supabase project** (his account) and is running a local copy of the app against it — deliberately **not** touching the partner's live NGU Supabase project or the shared Vercel deployment. Nothing in this note has been applied to production.

## Decision under discussion: keep the single-project workspace model

Nick floated **one Supabase project per company** (the partner knows other construction firms who might use the software). My recommendation is to **not** make that the default, and instead keep the multi-tenant model the repo already has: **one project, many companies separated by `workspace_id` + RLS** (see `supabase/migrations/20260612100000_tenant_scoping.sql`).

Reasoning, for the partner's review:

- **Project-per-company moves complexity onto us, not away from the customer.** Every customer becomes a project to provision, migrate, upgrade, monitor, back up, and bill. That's the opposite of "spare small businesses the confusing infrastructure parts." It does not scale past a handful of customers operationally.
- **The pooled workspace model is the standard SaaS pattern** for selling to many small businesses. A new customer = a new `workspaces` row created at signup. They never see SQL, keys, or infra.
- **It also serves the cost-prediction goal** (below): pooled data means cross-company analytics is a single query; separate projects would force a whole extract-and-warehouse pipeline just to recombine the data.
- **Keep project-per-company as an enterprise escape hatch**, not the default — offer physically isolated projects only to the rare large client who contractually requires it. Pooled-by-default, dedicated-on-request is how mature SaaS tiers this. Don't build it until someone pays for it.

## Cost-prediction layer (forward, not built)

The "Cost Prediction" idea (see the `Cost Prediction SaaS` planning workspace referenced in the README) should sit on top as an **opt-in, anonymized, cross-tenant** feature: a central, normalized table of cost observations — roughly `(industry, region, category, item, unit, unit_cost, quantity, date, company_hash)` with no names/PII — that the prediction model trains on. Each workspace contributes into it; raw per-company data stays private. Caveat for when this becomes a real multi-customer SaaS: pooling cost data across **independent** clients needs consent, and only aggregated/anonymized benchmarks are ever exposed — never one company's raw costs to another. (For a family-of-companies start this is moot, but worth designing in from the beginning.)

## Boutique vertical — first proof of the chassis/industry-pack split

To test "generalize to other industries," I drafted a **second vertical on the same chassis**: a San Antonio family member's retail **boutique**. It sells both in-store and online and needs inventory, sales, suppliers/purchasing, customer CRM, **pop-up event scheduling** across San Antonio, and a **social media marketing calendar** — none of which the construction domain has.

The boutique gets its **own** domain tables (prefixed `boutique_`) bolted onto the existing chassis (`workspaces`, `workspace_members`, `profiles`, RLS, storage, helpers) — exactly the "generic platform + per-industry domain pack" structure that generalization needs. Tables: `boutique_suppliers`, `boutique_products`, `boutique_variants` (unified stock), `boutique_customers`, `boutique_events` (pop-ups), `boutique_sales` / `boutique_sale_items`, `boutique_purchase_orders` / `boutique_po_items`, `boutique_marketing_posts`. All `workspace_id`-scoped, reusing `is_workspace_member()` and `update_updated_at()` from the existing schema.

## New files this session (in `supabase/setup/`, currently uncommitted in Nick's tree)

A paste-and-run setup kit so anyone can stand up an isolated sandbox without touching production:

- `01_full_setup.sql` — the two existing migrations (initial_schema + tenant_scoping) merged in order, idempotent.
- `02_seed_demo_data.sql` — sample construction data to verify end-to-end.
- `03_boutique_vertical.sql` — the boutique domain pack described above.
- `04_seed_boutique_demo.sql` — sample boutique data (products, a pop-up, a sale, a social post).
- `README_SETUP_STEPS.md` — plain-language run order.

These are **not** in this commit (this note is docs-only); they live in Nick's working tree. Flagging so the partner knows they exist and can ask to have them pushed for review.

## Open questions for the partner (and his agents)

1. **Tenancy:** agree to keep the pooled `workspace_id` + RLS model as the default, with project-per-company reserved as an enterprise-only option?
2. **Boutique:** OK to treat the boutique as the first non-construction vertical / chassis proof? It validates the generalization thesis cheaply.
3. **Cost prediction:** want the central anonymized cost-observation schema designed next, or hold until the per-vertical app work is further along?
4. **Boutique UI:** the database can exist, but the app's *screens* are still construction-only. A real boutique would need its own pages (products, inventory, pop-up calendar, social planner). Sequencing TBD.

## Status / housekeeping

- Local clone was 1 commit behind `origin/main` at session time — the partner's "Secure service-role API routes (A1 + A2) (#2)" had merged. Pull before further work.
- This note was pushed on a **review branch**, not `main`, since pushing `main` auto-deploys to the live NGU site (see [`09_BRANCH_RESOLUTION_2026-06-10.md`](./09_BRANCH_RESOLUTION_2026-06-10.md)).
