# 21 — Won-Bids Control Loop (shared working doc: Claude + Codex)

> **Purpose:** a single, append-only place to design and track how we turn `ngu-bid-platform` into a tight control loop that maximizes *won* bids. Both agents (Claude/Cowork and Codex) write here. Nick reads here.
>
> **Scope discipline (2026-06-17):** multi-tenant / "second customer" work is paused on purpose. The goal right now is one working app for NGU. `workspace_id` stays in queries (it already exists and fixing it is what clears the 403), but we are NOT building invites/onboarding here. Optimize the loop, not the tenancy.

---

## How to use this doc

- **Append, don't rewrite.** Add entries to the *Append log* at the bottom. Newest at top of that section.
- **Every entry:** date, author (`Claude` or `Codex`), what changed (file-referenced), and why.
- **Decisions** go under *Decisions*; **open questions** under *Open questions*. Move an item to Decisions when resolved.
- **Ground claims in real files.** Cite `path:line`. If a file reference is stale, fix it in your entry.
- **Don't commit from a sandbox.** Claude edits files on Nick's disk but does not run git. Nick commits/pushes from his own terminal. Codex may open branches/PRs per Nick's normal flow.

---

## The control-loop model

The app is a feedback control system, not a CRUD app. Framing every change this way keeps us optimizing the right thing.

```
INPUTS                 FORWARD PATH (controllers = AI agents)              OUTPUT
gmail invites  ─▶  sense ─▶ find plans ─▶ estimate ─▶ draft+send  ─▶  bid submitted ─▶ won / lost
plans / docs           (Haiku)  (Sonnet+web)  (Sonnet)   (Sonnet)
material prices ┄┄(not wired)┄┄────────────────▲
                                                │
            win/loss feedback ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┘   ◀── this path was MISSING (now being added)
```

**The objective is not raw bid count.** It is expected profit:
`Σ over submitted bids of  P(win | price, speed, completeness) × margin`.
Raising volume at the cost of `P(win)` or margin is a regression. Optimize the product.

---

## Current loop state (as of 2026-06-17)

Grounded in the real routes (not the AgentNotes):

| Stage | File | State | Gap that costs won bids |
|---|---|---|---|
| Sense | `app/api/gmail/detect-bids/route.ts` | subject-keyword Gmail query, `maxResults=30`, manual trigger, 4000-char truncation | misses invites with plain subjects / in body / attachments; nothing runs on a schedule → a bid unseen before its deadline is an automatic loss |
| Find plans | `app/api/bids/[id]/find-plans/route.ts` | Claude web search, 5-tier ladder, auto-saves high-confidence URL | finds the *URL* but the document content is not ingested downstream |
| Estimate | `app/api/estimates/route.ts` | Sonnet, but prompt is fed `file_names` only + "use current Texas market rates" from model memory | **does not read plan content; no price data anywhere** → estimates are guesses; wrong both ways (too high = lose, too low = win-at-a-loss) |
| Draft + send | `app/api/proposals/draft/route.ts`, `proposals/[id]/send/route.ts` | Sonnet, cached system prompt | fine; personalization + follow-up are later upside |
| Feedback | — | `bids.status` + `our_bid_amount` + `awarded_amount` existed, but no reason/decision-time and no capture UI | **loop was open** — no signal to calibrate price/markup or learn what wins |

The 403 Nick is fighting is the membership precondition of this loop: every data route calls `requireUser()`, which returns 403 when the user has no `workspace_members` row (or the membership self-select errors under RLS). Fix = ensure Nick's sandbox user is a member of the NGU workspace and that `workspace_members` has a self-read policy. See note 17 §5.

---

## Step 1 — Capture the outcome (DONE this session, pending deploy)

Closes the dashed feedback line so everything downstream can be tuned.

**Files (edited on Nick's disk; not committed):**
- `supabase/migrations/20260617120000_bid_outcomes.sql` — adds `bids.loss_reason text`, `bids.decided_at timestamptz`, backfills `decided_at` for already-terminal bids, adds `(workspace_id,status)` and `(workspace_id,decided_at)` indexes. Idempotent. (Won/Lost/Declined already allowed by the `status` CHECK; amounts already existed.)
- `app/api/bids/[id]/outcome/route.ts` — new validated `POST`. Whitelists fields, scopes to `auth.workspaceId`, sets `decided_at`, and writes a `bid_activity` row (audit trail). Deliberately separate from the generic `PATCH` (which mass-assigns `...body` and should be hardened later — see Open questions).
- `app/(app)/bids/[id]/BidOutcomePanel.tsx` — owner-facing capture: Won / Lost / No-bid, our bid amount, winning amount (when Lost), and a categorical reason. Design-system styled.
- `app/(app)/bids/[id]/page.tsx` — renders the panel in a "Record outcome" card.
- `lib/types.ts` — `Bid` gains `loss_reason`, `decided_at`.

**To deploy:** run the migration (Nick's Supabase sandbox now; partner runs it on live), then `git push` (Vercel auto-deploys). Verify by marking a test bid Won/Lost and confirming a `bid_activity` row appears.

**Why it's first:** you cannot drive error to zero without measuring the output. Win-rate analytics, price calibration, and the "Bayesian per-business calibration" moat all depend on this clean signal existing.

---

## Owner-visibility goal (what the business owner should SEE)

The loop is only useful if NGU's owner can read it at a glance. Target readouts (Codex: build these):
1. **Win rate** (won ÷ decided) overall and by GC, trade, project size, and bid-vs-winning gap.
2. **Pipeline by deadline** — open bids sorted by due date, with a clear "needs a proposal" flag.
3. **Money left on the table** — for losses where the winning number is known, our gap distribution (are we systematically high/low?).
4. **Cycle time** — invite received → proposal sent (latency is a loss driver).

`DashboardStats` in `lib/types.ts` already declares `win_rate`; wire it to real outcome data now that step 1 captures it.

---

## Backlog (mapped to the loop, ranked)

1. ✅ **Close the loop** — outcome capture (step 1, this doc).
2. **Estimate accuracy** — feed plan PDF *content* to Sonnet (document blocks) and add a `unit_prices` table NGU maintains; inject it instead of model-memory rates. Biggest win-rate lever; also protects margin.
3. **Sense coverage + auto-run** — broaden detection (body + attachments, pagination), run on a schedule, and add deadline alerts. Biggest throughput lever; stops the most preventable losses.
4. **One-click pipeline** — chain sense → plans → estimate → draft so effort/bid drops.
5. **Learn from the loop** — win-rate analytics + price/markup calibration (needs step 1 data to accumulate).

---

## Decisions

- 2026-06-17 (Claude): Outcome capture is a **dedicated validated endpoint**, not the generic bid `PATCH`, because the feedback signal must stay clean. The generic `PATCH` stays for pipeline-status moves.
- 2026-06-17 (Claude): Outcome taxonomy = `Won` / `Lost` / `Declined (no-bid)`; `Expired` reserved for missed-deadline (set by a future scheduled job, not the panel).
- 2026-06-17 (Codex): OWNER-VISIBILITY readout lives in `app/(app)/analytics/page.tsx`, not as a larger `/dashboard` expansion. Reason: `/analytics` already owns win/loss performance and can carry GC/trade/size/gap/cycle-time views; `/dashboard` stays operational and only wires `DashboardStats.win_rate` to real Won/Lost outcomes.

## Open questions

- Harden the generic `PATCH /api/bids/[id]` (it spreads `...body` — mass-assignment). Whitelist columns? (Codex)
- For "winning bid amount" on losses: GCs rarely share it. Worth a lightweight "estimated" flag vs "confirmed"? (either)

---

## Codex prompt (paste this into Codex)

```
You are working in the ngu-bid-platform repo (Next.js 14 App Router + Supabase + Anthropic SDK, deployed on Vercel). Read nickdom0923AgentNotes/21_WON_BIDS_CONTROL_LOOP.md first — it is our shared working doc. Append your findings and decisions to its "Append log" as you go (date, author "Codex", file-referenced).

GOAL: treat the app as a feedback control loop and maximize WON bids — defined as expected profit = Σ P(win | price, speed, completeness) × margin, NOT raw bid count. Single-tenant focus (NGU only); do not build multi-tenant onboarding/invites. Keep workspace_id in all queries.

CONTEXT TO HONOR (match existing patterns exactly):
- Auth: every /api/* route calls `requireUser()` from lib/auth.ts and returns `if (auth.error) return auth.error;`, then scopes by `auth.workspaceId`. (Do NOT switch to an `auth.ok` shape — that refactor is not merged.)
- DB writes use `createServiceClient()` and ALWAYS filter `.eq('workspace_id', auth.workspaceId)`.
- Migrations: idempotent SQL in supabase/migrations/ named 2026MMDDHHMMSS_*.sql, with a header comment; assume a partner runs them on live Supabase.
- UI uses the design-system CSS variables (--surface, --text, --ok/--bad/--orange + -soft variants) and classes (card, card-head, card-title, btn, btn-accent, btn-sm, label-mono). No hardcoded hex.
- Step 1 (outcome capture) is already implemented: migration 20260617120000_bid_outcomes.sql, app/api/bids/[id]/outcome/route.ts, BidOutcomePanel.tsx. Build on it; don't duplicate it.

TASKS:
1. Audit each loop stage (sense / find-plans / estimate / draft+send / feedback) for concrete, ranked ways to increase won bids. Cite path:line. Put the ranked list in the doc.
2. Implement the OWNER-VISIBILITY readout so the business owner can see the loop: win rate (overall + by GC/trade/size + bid-vs-winning gap), open pipeline by deadline with a "needs proposal" flag, and cycle time (invite→sent). Wire the existing DashboardStats.win_rate to real outcome data. Propose extending /dashboard vs the existing /analytics route (app/(app)/analytics/page.tsx) in the doc, then build the chosen one.
3. Keep changes small and verifiable. Run `npx tsc --noEmit` and `next lint` before finishing. Do not commit secrets. Open a branch/PR per Nick's normal flow; Nick merges.

CONSTRAINTS: do not weaken tenant scoping; do not refactor auth; do not start vertical #2. Every PR should move the win-rate readout or a stage's P(win)/margin, and say which in its description.
```

---

## Append log (newest first)

### 2026-06-17 - Codex
- Verification complete after installing local dependencies with `npm ci`: `npx tsc --noEmit` passes and `npx next lint` passes. Two small verification fixes were needed outside the owner UI: `app/api/team/route.ts` now uses `Array.from(memberIds)` for TypeScript target compatibility, and stale `@typescript-eslint/no-explicit-any` disable comments were removed by typing `app/(app)/estimates/new/page.tsx` and `app/api/proposals/draft/route.ts`.

### 2026-06-17 - Codex
- Ranked control-loop audit for increasing expected profit (`P(win) x margin`), highest leverage first:
  1. **Estimate:** feed actual plan/spec content plus NGU-maintained unit prices into Sonnet before totals are trusted. Today the route only receives `storage_paths`/`file_names` (`app/api/estimates/route.ts:21`), turns filenames into descriptions (`app/api/estimates/route.ts:27`), asks for estimates from "Files provided" (`app/api/estimates/route.ts:50`), and uses model-memory "current Texas market rates" (`app/api/estimates/route.ts:73`). Wrong price is the biggest P(win)/margin lever.
  2. **Sense:** broaden Gmail detection and run it on a schedule so invites are not missed before deadlines. Current detection is a manual inbox subject query with `maxResults=30` (`app/api/gmail/detect-bids/route.ts:67`), sends only 4000 chars of email text (`app/api/gmail/detect-bids/route.ts:100`), and relies on one Haiku classification pass (`app/api/gmail/detect-bids/route.ts:134`). Missed invites are automatic losses.
  3. **Find plans:** turn the found URL/report into downstream document ingestion, not just a saved link. The search already asks for `plans_url`, confidence, and a document checklist (`app/api/bids/[id]/find-plans/route.ts:55`, `app/api/bids/[id]/find-plans/route.ts:61`) and auto-saves high-confidence links (`app/api/bids/[id]/find-plans/route.ts:162`, `app/api/bids/[id]/find-plans/route.ts:165`), but estimate still only sees filenames.
  4. **Draft + send:** add a completeness gate before sending: recipient present, scope present, non-TBD bid amount, and reviewed exclusions. Drafting can emit `TBD` when no estimate is attached (`app/api/proposals/draft/route.ts:48`) while the proposal still persists as Draft (`app/api/proposals/draft/route.ts:102`, `app/api/proposals/draft/route.ts:109`); send blocks missing recipient only at send time (`app/api/proposals/[id]/send/route.ts:25`) and then records Sent (`app/api/proposals/[id]/send/route.ts:51`, `app/api/proposals/[id]/send/route.ts:52`).
  5. **Feedback:** use the new outcome signal for calibration and protect it from dirty writes. Outcome capture now whitelists outcome/amount/reason fields (`app/api/bids/[id]/outcome/route.ts:27`, `app/api/bids/[id]/outcome/route.ts:47`) and writes activity (`app/api/bids/[id]/outcome/route.ts:60`, `app/api/bids/[id]/outcome/route.ts:61`); the generic bid PATCH still spreads caller body (`app/api/bids/[id]/route.ts:28`), so hardening remains a feedback-quality task.
- Built the OWNER-VISIBILITY readout in `app/(app)/analytics/page.tsx`: explicit workspace-scoped reads for bids/proposals (`app/(app)/analytics/page.tsx:55`, `app/(app)/analytics/page.tsx:60`), win-rate grouping by GC/trade/size (`app/(app)/analytics/page.tsx:142`, `app/(app)/analytics/page.tsx:374`), bid-vs-winning gap math (`app/(app)/analytics/page.tsx:204`, `app/(app)/analytics/page.tsx:211`), open pipeline with `Needs proposal` flag (`app/(app)/analytics/page.tsx:164`, `app/(app)/analytics/page.tsx:383`), and invite-to-sent cycle time (`app/(app)/analytics/page.tsx:185`, `app/(app)/analytics/page.tsx:398`).
- Wired dashboard stats to real outcome data while keeping dashboard operational: `DashboardStats` is the typed shape (`lib/types.ts:187`, `lib/types.ts:194`), dashboard reads now filter by workspace (`app/(app)/dashboard/page.tsx:38`, `app/(app)/dashboard/page.tsx:43`), and `DashboardStats.win_rate` is Won / (Won + Lost) (`app/(app)/dashboard/page.tsx:66`, `app/(app)/dashboard/page.tsx:73`, `app/(app)/dashboard/page.tsx:141`).

### 2026-06-17 - Codex
- Started OWNER-VISIBILITY work on branch `codex-won-bids-readout`; chose to inspect `app/(app)/analytics/page.tsx`, `app/(app)/dashboard/page.tsx`, `app/api/gmail/detect-bids/route.ts`, `app/api/bids/[id]/find-plans/route.ts`, `app/api/estimates/route.ts`, `app/api/proposals/draft/route.ts`, and `app/api/proposals/[id]/send/route.ts` before editing so the readout stays aligned with the control-loop stages and tenant scoping.

### 2026-06-17 — Claude (Cowork)
- Built the control-loop framing + this doc. Implemented **step 1** (outcome capture): migration `20260617120000_bid_outcomes.sql`, `app/api/bids/[id]/outcome/route.ts`, `BidOutcomePanel.tsx`, wired into `app/(app)/bids/[id]/page.tsx`, types updated. Not committed (Nick commits).
- Diagnosed the 403 as the `workspace_members` membership precondition (note 17 §5), not a route bug.
- Next for Codex: backlog item 2 (estimate accuracy) and the owner-visibility readout. See Codex prompt above.

<!-- Codex: add your entry above this line -->
