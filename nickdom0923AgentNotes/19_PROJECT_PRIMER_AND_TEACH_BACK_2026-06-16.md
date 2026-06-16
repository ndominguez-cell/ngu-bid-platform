# 19 — Project Primer & Teach-Back (2026-06-16)

**What this is:** a one-page mental model of the whole project, written as the saved output of a `teach-the-session` debrief with Nick. Meant as the fastest on-ramp for a human or agent who is new to this repo. Read this, then the README index, then dive where you need.

## The product in one breath
A bid-management SaaS the partner built for **NGU Construction** (one live customer). Loop: Gmail bid invite → bid record → AI estimate from plan PDFs → AI proposal email → send → win/loss. Stack: Next.js 14 on Vercel, Supabase (Postgres/Auth/Storage), Claude. Goal beyond NGU: a reusable **chassis** for multi-tenant, multi-vertical small-business SaaS (see [00](./00_SCOPE_AND_GOALS.md)).

## The four nouns that ARE the security model
- **`workspaces`** = a company. **`workspace_members`** = who's in it + role (`owner/admin/estimator/viewer`) — this is "owner invites employees." **`workspace_id`** = stamped on every business row. **RLS** = Postgres rule "see only your workspace's rows," via `is_workspace_member()`.
- Mental model = *company1(owner)→employees | company2(owner)→employees | …* — already implemented in the A3 migration.

## The wrinkle that causes most bugs
API routes use the **service-role** Supabase client, which **bypasses RLS**. So isolation depends on every query manually adding `.eq('workspace_id', auth.workspaceId)`. One forgotten filter = cross-tenant leak; the DB won't stop it. Long-term fix: lean back on RLS + minimize service-role.

## The recurring lesson (the "why behind the why")
**Never trust client input for authority.** Signup metadata `role`, OAuth `state`, a `bid_id` in a body, a storage path — all attacker-controllable. Authority = server-validated session + `workspace_members`, nothing else. Most of notes 02–17 are instances of this one lesson.

## The notes as a story
02 = the trigger (Nick saw all NGU bids). 04/05/06 = it's worse (public `/api/*`, self-promote to admin, OAuth CSRF). 11/12 = senior reviews of the fix branch `feature/a3-tenant-scoping`. 13 = Tier-0 "fix even with one customer." 14 = middleware was deleted on purpose (Edge crash) — don't restore. 15 = partner Supabase handoff (+ its deploy-order bug). 16 = stack/costs (keep Supabase Auth, add Resend, ~$65/mo). 17 = Tier-1 hardening plan with diffs. 18 = corrected merge runbook. 19 = this primer.

## The live decision: merging A3
Git merge is a clean fast-forward (no conflicts). The risk is **runtime**: new code 403s on an unmigrated DB; old code fails inserts on a migrated DB. Use **expand → deploy → contract**. Two-person op: Nick=Vercel/code, partner=Supabase/migrations; they move together. See [18](./18_MERGE_RUNBOOK_2026-06-16.md).

## Where we go next
1. Merge A3 safely (18). 2. Tier-1 hardening (17): one role source, **invite flow** (also kills public-signup pollution), UUID bid-IDs, FK integrity, typed `requireUser()`; add Resend. 3. Tenant-isolation **test harness + CI** (no regressions). 4. Then modules as building blocks (each: own workspace-scoped tables + RLS + engine + UI + optional agent skill, toggled via `workspaces.settings`): **Deal-Intel** procurement intelligence (construction first, for the bid flywheel) → **Forecasting** (Cost-Prediction math) → marketing.

## Checklist covered in the teach-back (all confirmed)
- [x] Problem: tenant isolation + service-role bypass + client-trusted authority.
- [x] Solution: workspaces/members/workspace_id/RLS; per-route `requireUser()` + scoping.
- [x] Why it matters: second customer turns a bug into a breach; isolation is the spine of Stages 3–4.
- [x] Edge cases: unmigrated-DB 403, polluted `profiles` allowlist, deleted middleware, cross-workspace FK injection, bid-ID collisions.

*Saved from a teach-the-session debrief, 2026-06-16. If you're onboarding, ask Nick for an eli5/eli14 pass on any module.*
