# 24 — Security + Feedback-Loop Integration (2026-07-14)

> **Author:** Claude (Cowork), at Nick's direction.
> **What this is:** the record of folding the last two valuable branches into `main`, what went to the live DB, and the one step that must wait for deploy. Companion to the note-21 security review and note-21 won-bids control loop.

## What landed

Merged into `main` via branch `integration/security-and-feedback-loop` (11 commits on top of the prior `main`):

- **`claude/security-items-review-hh13hl`** — every note-21 finding: H1 (Google-token exposure on `profiles`), H2 (LLM-field URL/email validation), M1 (bid mass-assignment allowlist + FK checks), M2 (roles enforced on `workspace_members.role`), M3 (CSV injection), M4 (seed hardening), M5 (AI rate limiting), M6 (team pagination), L1–L7, plus AES-256-GCM token encryption at rest (`TOKEN_ENC_KEY`).
- **`codex-won-bids-readout`** — the win/loss feedback loop: `POST /api/bids/[id]/outcome`, `BidOutcomePanel`, `bid_outcomes` migration, analytics readout (win rate by GC/trade/size, bid-vs-winning gap, pipeline by deadline, cycle time), dashboard win-rate wired to real Won/Lost data.

**Conflict resolutions worth knowing:** both branches independently rewrote the estimator. We kept the security branch's stronger estimator (reads actual plan document content, structured JSON takeoff with confidence/gaps) and **re-integrated the workspace markup + margin defaults** that branch had dropped, so `estimates/route.ts` and `reanalyze/route.ts` still apply both. One added fix (`settings/page.tsx`): it read Google tokens via `select('*')` on the browser client, which breaks under the H1 grant change — switched to granted-column select + server-side connection check.

## Live database (project `ikdynmhgvwhfgunfeyae`)

Applied and verified (idempotent, code fails open if absent): `estimating_defaults`, `bid_outcomes`, `estimate_takeoff`, `ai_rate_limits`.

**Deferred until AFTER the code deploys:** `security_followups.sql` (H1 grant-revoke + proposal `'Sending'` status). Running it before the new code is live breaks the deployed settings page (`SELECT *` on `profiles` -> permission denied) — verified empirically. Order: deploy -> confirm settings loads -> run it.

## Branch disposition

Only the two branches above had unique unmerged value; both are now in `main`. Superseded/stale/junk (safe to delete): `security-hardening-2026-06-24`, `docs/agent-notes-2026-06-13-tenancy-boutique`, `claude/amazing-darwin-Fiisg`, `feature/a3-tenant-scoping`, `feature/bid-list-open-filter-sort`, `claude/ngu-bid-platform-projects-xew97w`, `claude/busy-bell-FhUPD`, `claude/busy-davinci-AbDg3`, `sms-dashboard-deploy`.

## Still open (not branches — unbuilt work)

- Note-20 tenant-isolation test suite + CI (exists only as `tenant-isolation-tests.patch`).
- Estimator: NGU-maintained `unit_prices` table injected into the model (loop backlog item 2).
- Scheduled `detect-bids` + deadline alerts (loop item 3).
- Invite/onboarding UI (deferred; needed before a second customer).
- Supabase advisors: `auto_leads` RLS-no-policy, `SECURITY DEFINER` helper EXECUTE grants, leaked-password protection toggle.
- Set `TOKEN_ENC_KEY` in Vercel to activate token encryption.
