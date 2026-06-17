# 16 — Stack Decisions & Real Costs (2026-06-16)

**For:** Nick + the partner (and any agent acting for either).
**From:** Nick + Claude (Cowork).
**Why this note:** Nick saw a popular "$21/mo startup stack" making the rounds (Instagram reel). This note checks that list against what `ngu-bid-platform` already runs, flags the two tools that would fight our current architecture, and corrects the cost numbers. Like everything in this folder, this is a recommendation from Nick's side for discussion with the partner — not a ratified decision. **Auth and hosting are partner-owned territory; treat the Clerk section especially as "let's talk," not "done."**

---

## TL;DR

- The viral stack is a fine *greenfield* starter, but we're not greenfield — we already run Next.js + Supabase + Vercel + Stripe + GitHub.
- **Skip two** items because they duplicate or undermine what we've built: **Clerk** (we use Supabase Auth, and our whole tenant-isolation model keys off it) and **Pinecone** (Supabase ships `pgvector`).
- **Add, in order:** **Resend** now (needed for invitation emails once public signup is closed — see `15`), **Sentry + PostHog** as we approach real users, **Upstash** only if/when we need rate-limiting or queues.
- The "$21/mo" figure is misleading. A live, revenue-generating version is realistically **~$65/mo + Stripe fees** — still cheap, just not $21.

## The reel's list (what it claimed)

Claude=$20/mo · Supabase=free · Vercel=free · Namecheap=$12/yr · Stripe=2.9%/txn · GitHub=free · Resend=free · Clerk=free · Cloudflare=free · PostHog=free · Sentry=free · Upstash=free · Pinecone=free → claimed total **$21/mo**.

## The two to skip

### Clerk — no. We're on Supabase Auth, and that's load-bearing.

Our security model — `workspaces`, `workspace_members`, `is_workspace_member()`, and the RLS policies in `supabase/migrations/20260612100000_tenant_scoping.sql` — is built on Supabase Auth (`auth.uid()`). See `13_TIER0_SECURITY_FIXES` and `15_PARTNER_SUPABASE_HANDOFF`. Dropping Clerk in means running a *second* identity system inside the exact layer we're hardening for tenant isolation. Clerk *can* be bridged to Supabase via JWT templates, but that adds a moving part — and a place for the isolation model to spring a leak — right where we least want one. Clerk's free tier is genuinely generous now (50k MAU), so this isn't about cost; it's about not bolting a second auth system onto a security model we're mid-way through hardening. **Stay on Supabase Auth.**

### Pinecone — no. Use `pgvector`.

Supabase includes the `pgvector` extension, so if/when we want vector search (semantic search over bids, emails, docs), we store embeddings in the Postgres DB we already run, back up, and secure with the same RLS. A separate Pinecone account means another service, another SDK, another set of credentials — and its paid tier now carries a **$50/mo minimum** the moment we outgrow the free starter, whereas `pgvector` just scales with the database we already have. We don't need vector search yet anyway. **Skip Pinecone; reach for `pgvector` when the need is real.**

## What to add, and when

- **Now — Resend.** Note `15`'s blocker is that public self-signup polluted `profiles`. The fix is invitation-based onboarding, which means we have to *send invitations* — transactional email. Resend's free tier (3,000/mo, 100/day) covers us well past launch. This one is effectively required by the security work, not optional.
- **Approaching real users — Sentry + PostHog.** Error tracking and product analytics. Both free to start; add them when we have users whose errors and behavior are worth capturing.
- **Later — Upstash Redis.** Only when we actually need rate-limiting, response caching, or a job queue. Premature today.
- **Optional — Cloudflare DNS.** Fine, but Vercel + Namecheap already handle DNS. Add Cloudflare only for a specific feature we want from it.

## The real cost picture

| Tool | Reel says | Reality (verified 2026-06-16) | Our call |
|---|---|---|---|
| Vercel | Free | Hobby is **non-commercial**; a revenue SaaS needs **Pro $20/mo per seat** | Budget Pro at launch |
| Supabase | Free | Free **pauses after 7 days idle** (~30s cold wake); **Pro $25/mo/project** removes it | Free until users, then Pro |
| Stripe | 2.9% / txn | **2.9% + 30¢ per transaction**; scales with revenue | Correct — our real variable cost |
| Claude | $20/mo | $20 Pro floor; **more** with heavy API / Claude Code use | Expect north of $20 |
| Clerk | Free | Free to 50k MAU — but duplicates Supabase Auth | **Skip** |
| Pinecone | Free | Free starter; paid floor now **$50/mo** | **Skip** — use `pgvector` |
| Resend | Free | 3,000/mo, 100/day free | **Add now** (invites) |
| GitHub / Namecheap / Cloudflare / PostHog / Sentry / Upstash | Free | Accurate to start; each has paid tiers at scale | Add as needed |

**Realistic monthly once live and charging:** Vercel Pro ($20) + Supabase Pro ($25) + Claude ($20) ≈ **$65/mo**, plus Stripe's 2.9% + 30¢ per transaction, plus ~$12–15/yr for the domain. Resend / Sentry / PostHog stay free until we grow. The point isn't that it's expensive — it's a genuinely lean way to run a SaaS — it's that "$21" hides the commercial-tier reality so we plan for ~$65, not $21.

## Cross-references

- `00_SCOPE_AND_GOALS` — the growth thesis these tools serve.
- `13_TIER0_SECURITY_FIXES`, `14_MIDDLEWARE_DECISION`, `15_PARTNER_SUPABASE_HANDOFF` — the auth/tenant-isolation work that makes the "skip Clerk" call matter.
- `teach-the-session.md` (this folder) — the per-session teaching workflow Nick and the partner are adopting so both can explain what's in the repo.

## Sources (verified 2026-06-16)

- Vercel pricing / Hobby non-commercial — https://costbench.com/software/developer-tools/vercel/
- Clerk pricing (50k MAU free) — https://clerk.com/pricing
- Supabase free tier + 7-day pause — https://uibakery.io/blog/supabase-pricing
- Pinecone pricing ($50/mo paid floor) — https://costbench.com/software/vector-databases/pinecone/
- Resend free tier — https://nuntly.com/resend-pricing
- Stripe standard rate (2.9% + 30¢) — long-standing US online card rate

---

*Authored 2026-06-16 by Nick via Claude (Cowork). Recommendation for partner discussion; not a ratified joint decision.*
