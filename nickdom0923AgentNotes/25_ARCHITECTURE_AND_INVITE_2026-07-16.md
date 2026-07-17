# 25 — Chassis Architecture (two axes) + Invite Collaborator (2026-07-16)

> **Author:** Claude (Cowork), at Nick's direction.
> **Status:** architecture decision record + the first build step (invite collaborator). Written before the reset can eat it again. Companion to `03_GENERALIZATION_NOTES.md` and `10_TENANCY_DECISION_AND_BOUTIQUE_VERTICAL_2026-06-13.md`, which this consolidates and carries forward.

---

## Why this note exists

Nick asked two things: (1) add an "invite collaborator" feature so a workspace owner can add members, and (2) settle how one backend "chassis" can host both *different companies* and *different industries* (construction now, an online boutique later) without rebuilding the backend each time. Point (2) was already largely worked out pre-reset in notes 03 and 10; this note restates the decision cleanly and records the first concrete step of (1).

---

## The two axes of separation

There are **two independent** ways data is separated. Keeping them distinct is the whole design.

### Axis 1 — Company (tenant), *within* an industry
- Mechanism: `workspace_id` on every business table + Postgres RLS via `is_workspace_member()`.
- Status: **built and live.** Adding a company = insert one `workspaces` row + `workspace_members` rows. No new infrastructure. RLS guarantees company A cannot see company B.
- Prod today (`ikdynmhgvwhfgunfeyae`): 2 workspaces (NGU Construction + a demo), 1 member (Nick, owner).

### Axis 2 — Industry (vertical)
- Mechanism: **shared chassis + per-industry domain pack.**
  - *Chassis* (industry-agnostic, built once): auth, `workspaces`, `workspace_members`, `profiles`, RLS, storage, `is_workspace_member()`, `update_updated_at()`.
  - *Domain pack* (per industry): its own tables + its own AI prompts, all `workspace_id`-scoped, all reusing the chassis helpers.
- Status: **proven, not productized.** The boutique pack (`supabase/setup/03_boutique_vertical.sql`: `boutique_products`, `boutique_sales`, `boutique_suppliers`, …) is a full second vertical bolted onto the same chassis. It exists as a setup script; it is **not** in the prod DB and has **no** app screens yet.

Pooled-by-default (one Supabase project, many workspaces) is the decision from note 10. Project-per-company stays an enterprise-only escape hatch — don't build it until a client pays for physical isolation. Pooling is also what makes the cross-tenant cost-prediction flywheel a single query instead of a warehouse pipeline.

## How you swap "the database or the AI instructions" per vertical

Three layers; only the top two change per industry, the chassis never does:

1. **Domain tables** — a per-vertical table pack. A `workspaces.vertical` marker says which pack a workspace uses.
2. **AI instructions** — today every prompt is a hardcoded NGU string inside the route (`app/api/estimates/route.ts`, `proposals/draft`, `bids/[id]/find-plans`). The fix (note 03 §4) is to extract prompts into per-vertical templates with placeholders (`{{business_description}}`, `{{trades}}`, `{{region}}`) rendered at request time from per-workspace config. The code path stays single; the content comes from config. This is the lever that lets NGU and a boutique run the same route with totally different agent behavior.
3. **Per-workspace config** — the note-03 columns on `workspaces` (`business_description`, `trades_performed`, `region`, `signature`, brand colors, `vertical`). **Not in prod yet.** This is the gate to real multi-industry and is the recommended next scaffolding step after invites.

---

## Build step 1 (this note): Invite Collaborator

**Goal Nick stated:** owner can invite people; an invited collaborator can just be an `admin` for now; more granular roles can come later. Keep it simple.

**Why it was missing:** `/api/team` can list members and change roles, but there was no path to *add* a person, and no invitations table. `handle_new_user()` correctly gives new signups `viewer` + no workspace (default-deny), so invites are the intended controlled path to membership.

**What was built (additive only — nothing existing changes behavior):**
- Migration `supabase/migrations/20260716120000_workspace_invitations.sql` — new `workspace_invitations` table (email, workspace_id, role, secret token, invited_by, expiry, accepted_at) + RLS (members read their workspace's invites; writes via service role). Reuses `is_workspace_member()` and `uuid_generate_v4()`; touches no existing table.
- `POST /api/team/invite` — owner/admin only, scoped to caller's workspace; creates an invite and returns a shareable link. `GET` lists pending invites; `DELETE` revokes.
- `GET|POST /api/invite/accept` — token info + acceptance. Acceptance requires the logged-in user's email to match the invited email (blocks token reuse by another account), then inserts the `workspace_members` row with the invited role and marks the invite accepted.
- `app/invite/[token]/page.tsx` — accept landing page (outside the auth-gated group so a brand-new invitee can reach it); routes unauthenticated users to sign in / sign up and back.
- `TeamManager.tsx` — "Invite collaborator" input (email + role, default Admin) + pending-invite list with copy-link and revoke.
- `login` / `signup` — honor a safe relative `?redirect=` so an invite link survives the sign-in bounce.

**Default invited role:** `admin` (per Nick). The API still accepts `admin | estimator | viewer`; `owner` cannot be invited (owner is assigned at workspace creation / backfill only).

**One action required to activate:** the `workspace_invitations` migration must be applied to the prod Supabase project (`ikdynmhgvwhfgunfeyae`). It is additive and safe, but per the standing rule (prod-schema changes are partner-reviewed) it is **not** auto-applied. Run the migration file in the Supabase SQL editor, or have Claude apply it via the connector on Nick's go-ahead. The app fails gracefully (invite calls error) until the table exists; nothing else is affected.

---

## Future steps (queued, not done here)

1. **Vertical-config scaffolding** — add the note-03 `workspaces` config columns + extract AI prompts into per-vertical templates. The real gate to multi-industry. Bigger; touches the AI routes. Good candidate to hand to Codex/Hermes.
2. **Tenant-isolation test suite** — still only exists as `tenant-isolation-tests.patch`; push it + wire the CI workflow (note 20).
3. **Supabase advisor hardening** (safe, reviewable SQL): RLS policies for `auto_leads` and `ai_rate_limits` (RLS on, no policy); revoke `EXECUTE` from `authenticated` on the `SECURITY DEFINER` helpers (`get_user_role`, `is_workspace_member`, `shares_workspace_with`); enable leaked-password protection in Auth settings.
4. **`security_followups.sql`** — the deferred H1 grant-revoke + proposal `'Sending'` status. Code is now deployed, so the ordering constraint in note 24 is satisfied; running it is a deliberate call.
5. **`TOKEN_ENC_KEY` in Vercel** — set it to activate at-rest Google-token encryption (only Nick can).
6. **Email the invite automatically** — v1 returns a copyable link; wire Gmail send (already used by proposals) as a follow-up so invites go out without copy/paste.

---

## Files & references

- Chassis proof: `supabase/setup/03_boutique_vertical.sql`, `04_seed_boutique_demo.sql`.
- Prior decisions: `03_GENERALIZATION_NOTES.md`, `10_TENANCY_DECISION_AND_BOUTIQUE_VERTICAL_2026-06-13.md`, `24_SECURITY_AND_FEEDBACK_LOOP_INTEGRATION_2026-07-14.md`.
- Prod Supabase project: `ikdynmhgvwhfgunfeyae`. Vercel project: `prj_HB5Do0IjSQela0OiZNJSrbhjus9x` (team `ndominguez-2405s-projects`).
</content>
</invoke>
