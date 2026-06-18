# 22 — Security & Hardening Reconciliation (verified against the repo)

Date: 2026-06-18

Repo: `ngu-bid-platform`

Author: Claude (Cowork), at Nick's direction.

Status: working POV, drafted with Claude and **verified against the live repo** on 2026-06-18. Per [`00_SCOPE_AND_GOALS.md`](./00_SCOPE_AND_GOALS.md), security-architecture items are proposals to ratify with the partner, not unilateral changes.

## Why this note exists

On 2026-06-18, Nick drafted a "Security & Hardening" context doc from the phone app — a chat **without repo access**. It is a strong inventory of external tooling and forward ideas, but several of its "P0 / fix today" claims describe problems that are **already fixed in code**. This note reconciles that draft against the actual repo so no one re-does finished work.

It **supersedes** the draft's §1 ("verified repo state") and the §4 **P0** section, and **carries forward** the draft's still-valid tooling evaluations, LLM-risk framing, and P1/P2 backlog (below).

If you read only one thing: **the draft's entire P0 list is already addressed in code.** The real frontier is **P1** (rate limiting, input validation, security headers, file-upload + LLM hardening) and **tooling** (CodeRabbit), plus one **deploy-state unknown** only the live Supabase can answer.

## Verification basis

- Branch inspected: `codex-won-bids-readout` (current HEAD — ~21h ahead of `feature/a3-tenant-scoping`).
- Method: static read of `app/api/**`, `lib/auth.ts`, `supabase/migrations/**`, `next.config.mjs`, `vercel.json`, `.gitignore`, `package.json`.
- **Not** verified here: whether the migrations are **applied** to the partner's live Supabase (see "The one real unknown").

## P0 reconciliation — draft said "live exposures," repo says "already done"

| Draft claim (§4 P0) | Verified repo state | Verdict |
|---|---|---|
| Auth missing — "several routes callable with no account" (P0 #1) | 14/17 routes call `requireUser()`. The 3 that don't: the two OAuth endpoints (`/api/auth/google[/callback]`, which can't require a session they're minting) and `/api/profile` (does its own `getUser()` check; only touches the caller's own row). `/api/seed` is gated by `SEED_SECRET`. | **DONE** — nothing is anonymously callable. |
| "Zero `ENABLE ROW LEVEL SECURITY` / `CREATE POLICY` in committed migrations" (P0 #2) | **False.** `initial_schema` enables RLS on all 9 business tables. `tenant_scoping` (20260612) **drops** the permissive `auth_full` policies and replaces them with `is_workspace_member(workspace_id)` scoping, closes the profiles cross-tenant read, and **revokes column-level UPDATE** so authenticated users can't write `role`/Google tokens. `security_tier0` (20260615) adds workspace-scoped Storage RLS. | **DONE in code** (apply-state unverified — see below). |
| `/api/profile` self-role escalation, "fix today" (P0 #3) | Fixed at both layers: the route writes only `{ full_name, title }` with an explicit anti-escalation comment; the DB revokes `UPDATE` on `profiles` then re-grants only `(full_name, title, avatar_url)`. | **DONE.** |
| Lock/remove `/api/seed` in prod (P0 #5) | Gated by `SEED_SECRET`, workspace-scoped to "NGU Construction". No `NODE_ENV` guard. | **MOSTLY DONE** — optional belt-and-suspenders: add a prod/`NODE_ENV` guard. |
| Tenant isolation refactor (P0 #4) | `workspaces` + `workspace_members` + `workspace_id` on every table + RLS, **plus** a tenant-isolation test suite (`tests/`) and CI workflow (`.github/workflows/tenant-isolation.yml`). | **DONE in code**; deeper hardening tracked in note 17. |

Note: `requireUser()` still returns its **old** shape (call sites check `auth.error`, not `auth.ok`). The typed `{ ok }` refactor and role-authority unification are **tracked in [note 17](./17_TIER1_CHASSIS_HARDENING_PLAN_2026-06-16.md)** and not yet landed — that's the next layer, not a P0 gap.

## Branch-state drift (read before you "fix" anything)

The draft assumes "`main` vs `feature/a3-tenant-scoping`." Reality on 2026-06-18:

- Current branch is `codex-won-bids-readout` (won-bids owner-visibility work, ~21h old), **ahead of** the A3 branch.
- Uncommitted WIP in the working tree: modified `app/api/estimates/route.ts`, `lib/auth.ts`, `package.json`; untracked `tests/`, `.github/`, `supabase/config.toml`.
- So `tests/` + CI **exist on disk but aren't committed on this branch.** Sort the WIP / branch topology before opening a new security branch. Deploy ordering: [note 18](./18_MERGE_RUNBOOK_2026-06-16.md).

## What's genuinely still open (the real backlog)

De-duplicated against notes 13/17/20. Confirmed-absent in the repo today.

### P1 — before a second paying customer

1. **Rate limiting — none.** No `upstash`/`@vercel/kv`/ratelimit anywhere. AI routes (`proposals/draft`, `estimates`, `…/reanalyze`, `…/find-plans`) = uncapped Anthropic spend; auth = brute-forceable. Use a **distributed** store (Upstash Redis / `@vercel/kv`), not in-memory (won't work across lambdas).
2. **Input validation — none.** No `zod`/`valibot`. Routes destructure `await req.json()` raw and throw on malformed bodies. One zod schema per route input → structured 400.
3. **Security headers + CSP — none.** `next.config.mjs` has no `headers()`; `vercel.json` is `{}`. Add them in `next.config.mjs` `headers()` — **NOT** middleware (note 14). The only `dangerouslySetInnerHTML` is the **static** theme-preload script in `app/layout.tsx` (low risk; a CSP nonce/hash cleans it up).
4. **File-upload hardening — partial.** `presign` sanitizes the filename and namespaces the path by workspace, but has **no MIME-type check and no size limit**. Add both; keep buckets private + short signed-URL expiry.
5. **LLM-specific risks — mostly open, one key mitigation already present:**
   - *Human-in-the-loop is real.* `proposals/[id]/send` is a separate user-triggered POST (`requireUser` + workspace scope + "Already sent" guard) — nothing auto-sends. Keep it.
   - *Prompt injection.* Gmail bodies + PDFs flow into user-role prompt content (`detect-bids` = single user message; `proposals/draft` has a system/user split). Harden: delimit ingested text as **data**, constrain model output to an expected schema, never let output trigger a privileged action directly.
   - *Output sanitization.* No DOMPurify/sanitizer present. Today's only raw-HTML surface is the static theme script, and proposal/email text is sent as **MIME email** (not rendered as app HTML), so stored-XSS risk is **latent** — it becomes real the moment a future UI renders AI/email content as HTML. Add sanitization before that happens.
   - *Cost/abuse visibility.* No AI invocation/cost log (idea tracked in note 06) and no spend cap on the Anthropic key.
6. **Smaller P1s:** CSRF beyond OAuth + cookie flags (`HttpOnly`/`Secure`/`SameSite`); structured error handling, no stack/DB leakage (note 17 makes `requireUser` 500-on-error — generalize it); **audit-log population** — `bid_activity` is currently written only by the won-bids `outcome` route and read on the dashboard, still "barely used" per note 06; dependency scanning (`npm audit` in CI + Dependabot + GitHub secret scanning).

### P2 — before scale / multi-tenant GA

DB indexes + pagination on list endpoints; Supabase transaction-mode pooler for serverless; background queue for slow AI (PDF extract / estimate can exceed Vercel timeouts); retries/backoff + idempotency on the ingest path; Sentry + uptime check; confirm Supabase PITR and **test a restore**; branch protection on `main` requiring the note-20 suite; repo-privacy decision (public today → CodeRabbit free tier; private argues for it once real customer data lands); pre-launch compliance (privacy policy / ToS / DPA / data-deletion path — get a lawyer).

### Clean — do not "fix"

Secret hygiene: `.gitignore` excludes all `.env*` and `*.pem`; no env file is tracked; only `NEXT_PUBLIC_*` is client-exposed. Residual action: rotate any key ever pasted into a screenshot/DM, and confirm Vercel scopes service-role + Anthropic keys to **server** env only (never preview/fork).

## The one real unknown — is RLS actually live?

Everything above is **code** state. The single thing static analysis can't answer: have `tenant_scoping` + `security_tier0` been **applied to the partner's live Supabase project**? Deploys are a two-person op (Nick = Vercel, partner = Supabase; notes 15/18), so code-present ≠ prod-applied.

To close it (read-only, safe): run Supabase's **security advisor** against the live project (the connected Supabase tooling exposes `get_advisors: security`, or `list_tables` to see `rls_enabled` per table). It flags any table with RLS off or a permissive policy. Run it against the **right** project — the partner's prod, not Nick's boutique sandbox (note 10). Nick deferred this check in the 2026-06-18 session; pick it up when convenient.

## Carried forward from the phone draft — still valid

Net-new material not yet in the notes; keep it.

### Tooling (draft §3)

- **CodeRabbit — adopt now, partner-coordinated.** AI PR reviewer that automates the manual Cursor/Codex/Claude review pattern and targets our exact bug classes (auth bypass, role escalation, race conditions, missing constraints). Free on public repos. Path: trial on a Nick fork → propose org install on `ndominguez-cell/ngu-bid-platform` (the partner's domain, per 00) → add a path-scoped `.coderabbit.yaml` encoding our invariants (service-role without `requireUser`; new table without RLS; missing zod; unrate-limited AI/auth route; raw-HTML AI/email content). The draft contains a starter `.coderabbit.yaml` — **verify keys against docs.coderabbit.ai** before committing. Highest-leverage step: it turns this backlog into every-PR automation.
- **ui-ux-pro-max skill — optional, narrow.** Use only for the future analytics/forecasting dashboard (chart selection + a11y checklist). Do **not** run its `--persist` generator; the OKLCH tokens in `app/globals.css` are the source of truth.
- **21st.dev components — Stage-2, not now.** Parts bin for the future customer dashboard + marketing page. Resolve the shadcn/Radix-vs-hand-rolled foundation question **once** before pulling; reskin everything to NGU tokens.

### Open questions for the partner (draft §5)

- Is Stage 2+ on the table? It changes how much P1/P2 is worth doing now vs. just closing exposures.
- Repo privacy + who owns CodeRabbit / Vercel / Supabase billing as this grows.
- Acceptable human-in-the-loop boundary for AI (which outputs may act automatically vs. require review).

## Suggested next session (corrected for actual state)

The draft's §6 ("implement P0 #1 + #3, add RLS migration") is **already done** — don't repeat it. Instead:

1. **Close the unknown:** read-only Supabase advisor check that RLS is live in prod (section above).
2. **Land the open, low-blast-radius P1 wins** that need no schema/deploy coupling: security headers + CSP in `next.config.mjs`, and zod input validation per route. Both are code-only and guardrail-safe (note 14).
3. **Add `.coderabbit.yaml` + start the fork trial** so review is automated before the next layer.
4. **From note 17, take only the non-tenancy hardening now** — typed `requireUser` (500-on-error) + structured errors. The rest of note 17 (invites, role unification, bid-ID redesign, FK integrity) is multi-tenant work that **[note 21](./21_WON_BIDS_CONTROL_LOOP.md) deliberately pauses** (2026-06-17) to optimize the single-customer won-bids loop first; resume it only if the partner answers "yes" to Stage 2+ (open questions above), deploy-ordered per note 18.
5. **Use [`teach-the-session`](./teach-the-session.md)** before any merge.

---

*Drafted 2026-06-18 by Claude (Cowork) at Nick's direction. Verified against the repo the same day on branch `codex-won-bids-readout`. Corrects the phone-drafted security doc; carries forward its tooling + open-questions sections. Update as items land.*
