# nickdom0923AgentNotes — ngu-bid-platform

**Authored by:** Nick Dominguez ([nickdom0923](https://github.com/nickdom0923)) via Claude (Cowork).
**Created:** 2026-05-27.
**Purpose:** a shared notes folder for the AI assistants working on this repo (Nick's and the partner's) so we operate from the same map. Sibling pattern to [`Aios-Missioncontrol/nickdom0923AgentNotes/`](https://github.com/nickdom0923) — same conventions, different repo.

## Who Nick is in this repo

Nick is **not the partner who built `ngu-bid-platform`.** The partner owns NGU Construction (the San Antonio TX site-work / paving / concrete subcontractor this product was built for) and authored the v1 of this codebase end-to-end. Nick is collaborating from the outside: helping audit the code, propose architecture changes, and think through what comes after the v1.

Concretely that means:
- The partner owns decisions about NGU's day-to-day tool. If a change only affects NGU's workflow, that's the partner's call.
- Nick and the partner *jointly* own decisions about whether this codebase grows past NGU (multi-tenant SaaS, multi-vertical product). See [`00_SCOPE_AND_GOALS.md`](./00_SCOPE_AND_GOALS.md) for the working frame on that.
- These notes are recommendations from Nick's side of the conversation, drafted with Claude. Treat them as a working point of view, not ratified joint decisions.

## Multi-agent file convention

Same convention as the sibling notes folder, so any agent that has worked in either can move between them without surprise:

- **Files `00`–`03`** in this folder were authored by Claude (Cowork) on 2026-05-27, with a light update pass later the same day after Cursor and Codex contributed.
- **Files `04`–`05`** were authored by Cursor on 2026-05-27 (two debug passes).
- **Files `06`–`07`** were authored by Codex on 2026-05-27 (repo read + market research).
- Each of those original authors may update their own files; cross-agent edits should land as new files instead.
- **Future agent contributions** should land as new numbered files (`08_`, `09_`, …) using the form `NN_<AGENT>_NOTES.md` so authorship is obvious at a glance.
- **Counter-proposals or disagreements** should land as new files (e.g., `PARTNER_RESPONSE.md`, `CURSOR_DISAGREES.md`) rather than edits to another agent's note. Easier to diff, easier to revert, easier to read as a conversation.
- **Nick has final authority** to consolidate, rename, or delete anything in this folder. The partner has final authority over the rest of the repo.

## What's in this folder

| File | Author | What it is | When to read |
|---|---|---|---|
| [`00_SCOPE_AND_GOALS.md`](./00_SCOPE_AND_GOALS.md) | Claude | The map. Where the product is today (NGU's internal tool), Nick's four-stage growth thesis (optimize → templatize → multi-tenant construction SaaS → multi-vertical), how the two sibling projects feed in, and open questions for the partner. | Read **first**. |
| [`01_REPO_AUDIT.md`](./01_REPO_AUDIT.md) | Claude | Read-only audit of this repo as of 2026-05-27. Stack, domain model, the four AI surfaces, deployment story, what works well, what gaps to flag. Updated after Cursor/Codex review with additional gaps. | Read **second**. |
| [`02_TENANT_ISOLATION_BUG.md`](./02_TENANT_ISOLATION_BUG.md) | Claude | The original urgent bug — Nick signed up and saw all of the partner's bids. Three-layer diagnosis, fix sketch, backfill plan for the 29 existing NGU bids. Updated to note that the fix must follow an API-auth-coverage fix (per Cursor `04`) to be complete. | Read when planning the next concrete code change. |
| [`03_GENERALIZATION_NOTES.md`](./03_GENERALIZATION_NOTES.md) | Claude | What in the current code is NGU-specific vs already generalizable vs cheaply per-workspace. Sets up the "templatize" stage from `00`. | Read when discussing the multi-tenant refactor vs later sprints. |
| [`04_CURSOR_DEBUG_FINDINGS.md`](./04_CURSOR_DEBUG_FINDINGS.md) | Cursor | First debug pass — confirms tenant isolation, plus six additional findings: public `/api/*` access with service-role bypass, OAuth state CSRF, Gmail upsert missing unique constraints, broken CRM links, bid ID race condition. | Read with `02`. The unauthenticated-API finding (§1) is at least as urgent as the tenant bug. |
| [`05_CURSOR_SECOND_PASS_AND_FORWARD_IDEAS.md`](./05_CURSOR_SECOND_PASS_AND_FORWARD_IDEAS.md) | Cursor | Second debug pass — most importantly catches a self-role-escalation path through `/api/profile`. Also: New Bid form can fail when ID is blank, source enum drift, hardcoded PDF MIME type. Plus forward-looking sprint ideas. | Read before any role/permissions work. Finding §A.1 (self-promotion to admin) is fix-immediately. |
| [`06_CODEX_REPO_READ_AND_FORWARD_IDEAS.md`](./06_CODEX_REPO_READ_AND_FORWARD_IDEAS.md) | Codex | Independent repo walkthrough. Ratifies `02`/`04`/`05` findings, adds: print page uses browser handlers in a server component, dashboard quick actions misroute, seed data has dupe thread IDs that break a digest-email dedupe pattern, `bid_activity` exists but barely used, `.env.local.example` lags shipped code. Forward ideas: `requireUserContext()` helper, viewer-role enforcement, Bid Intake Review queue, assumption-aware estimates, AI invocation log. | Read alongside `01` §7. |
| [`07_MARKET_RESEARCH_PRODUCT_IDEAS.md`](./07_MARKET_RESEARCH_PRODUCT_IDEAS.md) | Codex | Web research across construction CRM (TopBuilder, iDeal, JobTread, Procore, Buildertrend), field service (BuildOps, Jobber, ServiceTitan), inbox CRM (Streak, Salesflare), work OS (Airtable, monday, ClickUp, Odoo, Zoho), payments (Square, Clover), and AI proposal tools (HeyIris). Maps patterns back to this codebase as Priority 0/1/2/3 product ideas and a five-sprint roadmap. | Read when discussing Stage 2/3/4 product direction from `00`. |
| [`08_PRODUCTIZATION_PUNCHLIST.md`](./08_PRODUCTIZATION_PUNCHLIST.md) | Claude | File-referenced punch-list to take the repo from NGU's internal tool to something a second construction subcontractor can pay for. A working checklist, not a vision doc. ⚠️ Audited at commit `d34ae22` — pull latest before implementing. | Read when planning productization work. |
| [`09_BRANCH_RESOLUTION_2026-06-10.md`](./09_BRANCH_RESOLUTION_2026-06-10.md) | Claude | Branch-resolution plan: state of the local clone vs GitHub `main`, with the git commands to run yourself (Claude can't push). | Read when untangling branches or before a risky merge. |
| [`10_TENANCY_DECISION_AND_BOUTIQUE_VERTICAL_2026-06-13.md`](./10_TENANCY_DECISION_AND_BOUTIQUE_VERTICAL_2026-06-13.md) | Claude | Tenancy direction + the boutique as a second vertical; builds on `00` and `03`. Uses Nick's own Supabase sandbox; nothing applied to prod. Working POV for partner review. | Read with `00`/`03` when discussing multi-tenant + new verticals. |
| [`11_CURSOR_A3_REVIEW.md`](./11_CURSOR_A3_REVIEW.md) | Cursor | Senior read-only code review of `feature/a3-tenant-scoping` (commit `299937e`). | Read before merging A3. |
| [`12_CODEX_A3_REVIEW_AND_STRUCTURE.md`](./12_CODEX_A3_REVIEW_AND_STRUCTURE.md) | Codex | Independent read-only architecture review of A3; reads `11` and proposes structure. | Read with `11` before merging A3. |
| [`13_TIER0_SECURITY_FIXES_2026-06-15.md`](./13_TIER0_SECURITY_FIXES_2026-06-15.md) | Claude | The three "fix even with one customer" items from the A3 review, verified against the schema. On `feature/a3-tenant-scoping`. | Read before merging A3 / during any security pass. |
| [`14_MIDDLEWARE_DECISION_2026-06-15.md`](./14_MIDDLEWARE_DECISION_2026-06-15.md) | Claude | Why `middleware.ts` is intentionally absent — don't restore it without a green Vercel preview deploy first. | Read before touching middleware / Edge. |
| [`15_PARTNER_SUPABASE_HANDOFF_2026-06-15.md`](./15_PARTNER_SUPABASE_HANDOFF_2026-06-15.md) | Nick + Claude | Self-contained handoff for the partner (who holds Supabase access) to run the A3 migrations safely — including the blocker: don't enroll polluted `profiles` as workspace members. | Read before running A3 migrations on the live project. |
| [`16_STACK_DECISIONS_AND_COSTS_2026-06-16.md`](./16_STACK_DECISIONS_AND_COSTS_2026-06-16.md) | Nick + Claude | Checks the viral "$21/mo stack" against ours: skip Clerk (keep Supabase Auth) and Pinecone (use `pgvector`), add Resend now, real cost ~$65/mo. Recommendation for partner discussion. | Read when choosing/adding infra or pricing a deployment. |
| [`17_TIER1_CHASSIS_HARDENING_PLAN_2026-06-16.md`](./17_TIER1_CHASSIS_HARDENING_PLAN_2026-06-16.md) | Codex | The Tier-1 hardening plan with real diffs + SQL + rollout: unify role authority on `workspace_members.role`, add an invite flow (table/endpoints/Resend), redesign bid IDs (UUID PK + per-workspace number), enforce cross-workspace FK integrity, and make `requireUser()` typed + 500-on-error. | Read after the A3 merge, before building the next layer. |
| [`18_MERGE_RUNBOOK_2026-06-16.md`](./18_MERGE_RUNBOOK_2026-06-16.md) | Claude | **Supersedes note 15's deploy ordering.** Why a code-first merge 403s the live site, and the corrected expand→deploy→contract sequence. Two-person op: Nick=Vercel, partner=Supabase. | Read **before merging A3**. |
| [`19_PROJECT_PRIMER_AND_TEACH_BACK_2026-06-16.md`](./19_PROJECT_PRIMER_AND_TEACH_BACK_2026-06-16.md) | Claude | One-page mental model of the whole project (the four nouns, the service-role wrinkle, the notes as a story, where we go next). Saved from a teach-the-session debrief. | Read **first** if you're new to the repo. |
| [`20_TENANT_ISOLATION_TEST_SUITE_2026-06-16.md`](./20_TENANT_ISOLATION_TEST_SUITE_2026-06-16.md) | Codex | Handoff for the tenant-isolation test suite + CI (`tests/`, `.github/workflows/`). Asserts cross-tenant access is blocked at both the API and RLS layers. Deliberately encodes the known failures from notes 11/17 — they go green as the hardening lands. | Read when wiring CI or verifying isolation. |
| [`teach-the-session.md`](./teach-the-session.md) | Claude | Reusable teaching workflow — after a change, make sure Nick + the partner understand it (walk the diff, restate, quiz, leave a note). A working asset, not a numbered note. | Use at the end of real-logic sessions. |
| [`PARTNER_MERGE_INSTRUCTIONS_2026-06-16.md`](./PARTNER_MERGE_INSTRUCTIONS_2026-06-16.md) | Claude (for the partner) | Plain-language, action-oriented merge instructions for the partner (who holds Supabase) and his agents: the prerequisites, the exact Supabase steps, the Nick-coordination, success checks, and rollback. | Read when the partner is ready to run the A3 migration + merge. |

## Reading order if you only have 15 minutes

0. **New to the repo? Start with [`19_PROJECT_PRIMER_AND_TEACH_BACK_2026-06-16.md`](./19_PROJECT_PRIMER_AND_TEACH_BACK_2026-06-16.md)** — the one-page mental model. Then come back here.
1. [`00_SCOPE_AND_GOALS.md`](./00_SCOPE_AND_GOALS.md) — the project frame and Nick's growth thesis.
2. [`02_TENANT_ISOLATION_BUG.md`](./02_TENANT_ISOLATION_BUG.md) §1 (observation) + §3 (fix sketch), then the new §0 cross-reference.
3. [`04_CURSOR_DEBUG_FINDINGS.md`](./04_CURSOR_DEBUG_FINDINGS.md) §1 (public API exposure) and [`05_CURSOR_SECOND_PASS_AND_FORWARD_IDEAS.md`](./05_CURSOR_SECOND_PASS_AND_FORWARD_IDEAS.md) §A.1 (self-role escalation).
4. [`06_CODEX_REPO_READ_AND_FORWARD_IDEAS.md`](./06_CODEX_REPO_READ_AND_FORWARD_IDEAS.md) §6 (the closing "one foundation" framing).

If you have 30 minutes, add: [`07_MARKET_RESEARCH_PRODUCT_IDEAS.md`](./07_MARKET_RESEARCH_PRODUCT_IDEAS.md) §3 (product ideas by priority) and §6 (sprint roadmap), then [`01_REPO_AUDIT.md`](./01_REPO_AUDIT.md) §1 + §7.

## Where the broader strategic context lives

These notes describe **the bid platform** specifically. The wider strategic conversation between Nick and the partner — what could become a joint SaaS product, how to think about generalizing past construction, the predictive-analytics ideas from the `Cost Prediction SaaS` planning workspace — lives in:

- [`../../Aios-Missioncontrol/nickdom0923AgentNotes/`](https://github.com/nickdom0923/Aios-Missioncontrol) — sibling notes folder for the Mission Control project. Files `00_SCOPE_AND_GOALS.md` and `05_GENERALIZATION_NOTES.md` there are the closest precedent for the thinking in this folder.
- `C:\Users\Nick\.agents\shared\Project\Cost Prediction SaaS\` — Nick's private planning workspace. Not in any repo. The business plan, predictive-analytics math, and SQL/pandas template library live there. Nick can share excerpts if any of it becomes relevant.

If you're an AI assistant on the partner's side and you'd like the broader context: ask the partner to share the Aios notes; they're a more developed version of the conversation this folder is starting.

---

*Folder created 2026-05-27 by nickdom0923 via Claude (Cowork). Index table refreshed 2026-06-16 — now covers notes `00`–`20`, `teach-the-session.md`, and `PARTNER_MERGE_INSTRUCTIONS_2026-06-16.md`.*
