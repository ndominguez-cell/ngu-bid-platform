# 00 — Scope and Goals

> **Audience:** any AI assistant (or human) working on `ngu-bid-platform`. Specifically written so the partner's assistants and Nick's assistants share the same map.
> **Author:** Claude (Cowork), at Nick Dominguez's direction, 2026-05-27.
> **Status:** Nick's working point of view, not a ratified joint decision. The partner has not yet weighed in on the stage 2–4 growth thesis.

---

## 1. The product in one paragraph

`ngu-bid-platform` is a working, deployed bid-management SaaS the partner built for **NGU Construction**, a San Antonio TX site-work / paving / concrete subcontractor. It collapses the entire bid lifecycle into one loop: Gmail bid invitation → auto-created bid record → AI-generated estimate from uploaded plan PDFs → AI-drafted proposal email → send via Gmail → win/loss tracked in analytics. Stack is Next.js 14 + TypeScript + Tailwind on Vercel, Supabase for Postgres/Auth/Storage/Realtime, and Anthropic Claude (Sonnet 4.6 for reasoning, Haiku 4.5 for fast extraction). Three deployment phases have shipped. The product currently has one customer: NGU.

## 2. Nick's four-stage growth thesis

Nick's view on where this codebase should go. This is the working frame; the partner has not ratified it.

### Stage 1 — Optimize for NGU (where we are now)

Make this excellent for the partner's actual business. Polish the four AI surfaces. Fix bugs. Add the features NGU's estimators ask for. This stage is **the partner's call** end-to-end — Nick's role is to help where useful, not to redirect.

There are now three Stage-1-critical security issues identified across the Cursor and Codex notes, listed here in fix order regardless of whether stages 2–4 ever happen:

1. **Self-role escalation** (Cursor `05` §A.1) — any signed-in user can PATCH their own `profiles.role` to `admin` through `/api/profile`. Fix-today item; doesn't require any architecture change, just remove `role` from the writable fields on that endpoint.
2. **Unauthenticated `/api/*` access with service-role bypass** (Cursor `04` §1) — `middleware.ts` marks every `/api/*` route public, and several routes (`/api/bids`, `/api/bids/[id]`, `/api/estimates`, `/api/proposals/draft`) use `createServiceClient()` without verifying the caller. This is a larger exposure than the tenant-isolation bug because it doesn't require an account at all. Fix is a request-context helper that every route uses; Codex `06` §4.1 sketches it as `requireUserContext()`.
3. **Tenant isolation** ([`02_TENANT_ISOLATION_BUG.md`](./02_TENANT_ISOLATION_BUG.md)) — once #1 and #2 are closed, this becomes the next step and is also the prerequisite for Stage 3.

All three are exposures even if the partner only ever uses this for NGU, because the URL is reachable from the public internet. Items #1 and #2 should land before anything else.

### Stage 2 — Find the template

Once Stage 1 is solid, do a read-through with the explicit question: *what in this codebase is NGU-specific vs reusable?* [`03_GENERALIZATION_NOTES.md`](./03_GENERALIZATION_NOTES.md) is the first pass, and Codex's market research in [`07_MARKET_RESEARCH_PRODUCT_IDEAS.md`](./07_MARKET_RESEARCH_PRODUCT_IDEAS.md) §3.2 and §4 validates the per-workspace settings list against what comparable products (TopBuilder, iDeal, Streak, Salesflare, Airtable) actually expose to their customers. The deliverable from this stage is a clean separation between:

- **Core platform** (auth, bids, estimates, proposals, CRM, document storage, AI surfaces — the part any subcontractor would use).
- **Per-workspace configuration** (logo, brand color, trades performed, company address, signature block, Texas-vs-other state defaults).
- **NGU-only customizations** (if any remain — ideally none, or clearly flagged).

This stage does *not* need a second customer to start. The work is internal restructuring driven by reading the existing code with fresh eyes.

### Stage 3 — Multi-tenant construction SaaS

Once the template is clean, allow other construction subcontractors to self-serve sign up, create a workspace, invite teammates (by invitation or shared email domain), connect their own Gmail, and run their own bid pipeline. Each company's data is isolated; nobody sees anyone else's bids, estimates, contacts, or emails.

The architecture pattern for this is already documented in the sibling project — `Aios-Missioncontrol`'s `workspaces` + `workspace_members` design with Supabase RLS scoping. The bug-fix in `02_TENANT_ISOLATION_BUG.md` is the same refactor, just framed as "make the bug not happen" instead of "build a SaaS." Doing it once buys both.

Pricing, billing, and onboarding UX are open questions for this stage. Nick has thoughts; they belong in a future note once the partner is engaged.

### Stage 4 — Multi-vertical

Once the construction SaaS is working, the same chassis can serve adjacent verticals — anyone who runs a sales pipeline that starts with an inbound email and ends with a quoted price. Other trades (HVAC, plumbing, electrical), wholesale dropshipping, custom manufacturing, even bespoke clothing. The per-workspace configuration from Stage 2 generalizes: instead of just "trades performed," it becomes "scopes performed" with vertical-specific prompt templates.

Stage 4 is far enough out that planning it now would be speculation. The point of naming it is so Stage 2's "what's NGU-specific" question gets asked with the right frame: we're not separating NGU from construction, we're separating NGU from *any small business that bids work*.

## 3. The aggregate-data flywheel (a Stage 3+ idea worth flagging early)

Once there are multiple subcontractor companies on the platform, the data the platform collects has compounding value:

- **Estimate → proposal conversion rates** by trade, scope, geography. Helps any company on the platform know which bids are worth pursuing.
- **Win/loss outcomes** by bid amount, markup percentage, GC, day-of-week, time-to-respond. Feeds back into estimate suggestions: "bids you've won at this scope have averaged 8.5% markup; you're proposing 12%."
- **Plan-room hit rates** for the bid plan finder. Which `.gov` and engineer domains actually surface complete plan packages for Texas public projects vs other regions.

This is one of the things the `Cost Prediction SaaS` planning workspace was built around — the math is the predictive layer that sits on top of this aggregate data once it exists. It is *not* something to build now; it is something to design the data model *so as not to preclude* later. Specifically: ensure the schema captures per-bid outcome, time-stamps every status transition, and stores estimate inputs alongside outcomes. Most of that is already true in the current `schema.sql` — worth keeping that property as Stage 3 adds the workspace dimension.

## 4. How the three projects relate

This repo is the chassis. The other two projects in Nick's working set are donors:

- **`Aios-Missioncontrol`** — the partner's older project. The multi-tenant architecture (workspaces + RLS membership, owner/manager/viewer roles), the agent/skills framing, and the local-first / VPS-hosted philosophy. The architecture donor for Stage 3.
- **`Cost Prediction SaaS`** — Nick's planning workspace (not a repo). The predictive analytics math (stochastic time-series, FFT seasonal decomposition, multi-objective optimization), and a library of SQL/pandas templates Nick extracted from his Fall 2024 coursework. The analytics donor for Stages 3–4.

The merger is not "fold all three into one codebase." It is: keep `ngu-bid-platform` as the running surface, port the Aios architecture pattern into it for Stage 3, and treat the Cost Prediction math as a Forecasting module that can be enabled per workspace once there's enough cross-tenant data to be predictive.

## 5. What's on Nick vs what's on the partner

Rough division. Not a contract — meant to surface where to push back if either of us has misread.

| Decision | Owner |
|---|---|
| What NGU's estimators need next (UX, features, bug priority) | **Partner** |
| Prompt wording, trade list, signature block, NGU branding | **Partner** |
| Whether to grow this past NGU at all | **Joint** |
| If yes: pricing, positioning, naming of the multi-tenant product | **Joint** |
| Schema changes that affect both NGU's tool and any future tenants | **Joint** — Nick to propose, partner to ratify |
| Tenant-isolation fix (`02_TENANT_ISOLATION_BUG.md`) | **Partner to ratify the approach, either can implement** — Nick proposing because of the immediate exposure |
| Code style, framework choices, deploy infra | **Partner** |
| Predictive analytics, cross-tenant data design (Stage 3+) | **Joint** — Nick's domain expertise is heaviest here |

## 6. Open questions for the partner

These are the things Nick would like the partner's input on before any large changes land:

1. **Is Stage 2+ even on the table?** If the partner wants `ngu-bid-platform` to stay as NGU's internal tool indefinitely, the Stage 1 security fixes still matter (because of the exposure) but the rest of these notes are aspirational and the codebase shouldn't be restructured to support it. If Stage 2+ *is* on the table, the workspace refactor in `02` is worth doing as a step toward that, not just as a bug fix.
2. **How does the partner want to handle the merger conversation?** Nick's working assumption is that if this becomes a joint SaaS, it's a joint product with shared upside — but those terms haven't been discussed. Nick would rather have an awkward conversation about equity / IP / decision authority now than build a year of work on top of an unstated assumption.
3. **Anything Nick is missing about NGU's actual workflow** that would change the framing above. The audit in `01` is read-only — there may be operational details (estimator team size, current bid volume, plan-room subscriptions, pricing model) that change which features are valuable in what order.

---

*Drafted 2026-05-27 by Claude (Cowork). Light update 2026-05-27 after Cursor and Codex review — added the three Stage-1 security issues in §2, cross-referenced the market research in §2 Stage 2, and reframed "tenant-isolation fix" as the third of three sequenced fixes rather than the only one. Update again when the partner weighs in or when Nick's view of the stages shifts.*
