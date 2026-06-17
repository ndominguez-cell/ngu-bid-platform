# 18 — A3 Merge Runbook (2026-06-16)

**Supersedes the "Deploy ordering" section of [`15_PARTNER_SUPABASE_HANDOFF`](./15_PARTNER_SUPABASE_HANDOFF_2026-06-15.md).**
Note 15 says "deploy the code first, then run the migration." **That is unsafe — do not follow it.** This note explains why and gives the corrected sequence.

**Author:** Claude (Code), at Nick's direction. Verified against the live git state on 2026-06-16.

---

## The one fact that drives everything

Merging `feature/a3-tenant-scoping` → `main` is a **clean fast-forward** (the branch is 5 commits ahead of `main`, zero divergence — no git conflicts). Merging **only** triggers a Vercel `next build` deploy; `vercel.json` is `{}` and the build runs no SQL. **Merging does not touch Supabase.**

So the danger is **not** the merge. The danger is **runtime schema coupling**:

- New [`lib/auth.ts`](../lib/auth.ts) `requireUser()` queries `workspace_members` on **every** authenticated request and returns **403** if it finds no membership row.
- Production Supabase has **no `workspace_members` table and no `workspace_id` columns** yet.
- Therefore **if A3 code is deployed before the DB is migrated, every authenticated API route 403s → the live site is broken** (dashboard loads, but data calls and inserts fail).

Verified: **old `main`'s `requireUser()` does not touch `workspace_members`** (it only checks the session). That's what makes a no-downtime path possible — the "expand" migration can run against the live old site without breaking it.

## Why note 15's "code first" order breaks the site

Note 15 reasoned: "new code stamps `workspace_id` but the DB still allows NULL — fine." That only holds **if the column already exists**. Before the migration runs, the column and the `workspace_members` table **don't exist at all**, so the membership query fails and the code 403s everywhere. Cursor's [note 11](./11_CURSOR_A3_REVIEW.md) §"Migration ordering" already flagged this: *"New code on old schema fails on missing tables/columns; old code on new schema fails inserts that omit workspace_id."* Use expand/backfill/contract.

## Who holds what (this is a two-person operation)

- **Nick** → Vercel + GitHub. Can merge/deploy code. **Cannot** run migrations.
- **Partner** → the Supabase project. Only they can run SQL, audit `auth.users`, take backups.

**The merge and the migration must happen in the same coordinated session.** Nick must not merge until the partner has done the Supabase side (or is standing by, for Option B).

---

## Hard prerequisites (gate BOTH options)

1. **Patch the enrollment blocker.** Lines 88–92 of [`20260612100000_tenant_scoping.sql`](../supabase/migrations/20260612100000_tenant_scoping.sql) enroll *every* `profiles` row as an NGU member. Public signup polluted `profiles`, so this hands strangers full NGU access. Replace with an explicit audited UUID allowlist (partner runs the audit query in note 15 §Step 1). See also file 17 §1 for the `on conflict … do update` shape.
2. **Take a Supabase backup.**
3. **Do NOT run `supabase/setup/0*.sql`** (full-setup / boutique / demo seeds) against production. Those are sandbox bootstrap scripts, not the NGU migration path.

---

## Option B — short maintenance window (RECOMMENDED while NGU is the only customer)

Simplest. Accepts a few minutes of downtime in a quiet hour.

1. Partner patches the allowlist (prereq 1) and pushes that commit to the branch.
2. Put the site in maintenance (a static page, or just pick a low-traffic hour).
3. Partner, in Supabase: backup → run `20260612100000_tenant_scoping.sql` → run `20260615120000_security_tier0.sql`. Run the verification queries in note 15 §Run order (member count == allowlist size; zero `workspace_id IS NULL` rows).
4. **Nick** opens a PR `feature/a3-tenant-scoping` → `main`, eyeballs the Vercel **preview** deploy, then merges. Vercel deploys to prod.
5. Verify on prod: log in as a real NGU account → list bids → create a bid. Take maintenance off.

The only exposed gap is between step 3 (NOT NULL on) and step 4 (new code live), where old code's inserts fail. That's why it's a window — keep it short.

## Option A — zero-downtime (adopt before customer #2)

Splits the migration so there's never a broken window. Requires editing the migration into two parts.

1. **EXPAND** (partner, Supabase): create `workspaces` + `workspace_members`; add `workspace_id` columns **NULLABLE**; create `is_workspace_member()` / `shares_workspace_with()`; seed the NGU workspace; enroll the **allowlist**; backfill `workspace_id` on existing rows. **Do not** add `NOT NULL` and **do not** replace the business-table RLS yet. Old `main` keeps working (its `requireUser()` ignores `workspace_members`; its inserts omit the now-nullable `workspace_id`).
   - Verify: `workspace_members` count == allowlist; existing rows backfilled.
2. **DEPLOY** (Nick): merge A3 → `main` via PR (review the preview). New code now finds memberships, stamps `workspace_id`, scopes reads. Verify as above.
3. **CONTRACT** (partner, Supabase): add `NOT NULL` on the `workspace_id` columns; swap the permissive `auth_full` RLS for the `workspace_member_all` policies; run `20260615120000_security_tier0.sql` (storage RLS + `handle_new_user`).

---

## After the merge — the Tier-1 chassis hardening (separate work, do NOT cram into this PR)

The A3 merge gets the branch shippable. The next layer (role-source unification, invite flow, bid-ID redesign, cross-workspace FK integrity, `requireUser()` → 500-on-error + typed result) is fully planned with diffs/SQL/rollout in **[`17_TIER1_CHASSIS_HARDENING_PLAN`](./17_TIER1_CHASSIS_HARDENING_PLAN_2026-06-16.md)**. Codex's suggested order there:

1. `requireUser()` → `auth.ok` + 500 on membership error (code-only, deploy after `workspace_members` exists).
2. Move role authority to `workspace_members.role`; strip `profiles.role` from team/settings/profile UI.
3. Add invitations table/endpoints/Resend (don't disable public signup until the controlled endpoints are live).
4. Bid-ID expand migration + atomic `allocate_bid_number()`.
5. Composite FK integrity (`not valid` → audit → `validate`).
6. Contract cleanup last (drop `profiles.role`, finish UUID PK migration, disable public signup).

Each of those is itself an expand/backfill/contract change requiring partner Supabase access.

---

*-- Claude (Code), at Nick's direction. Read 11, 13, 14, 15, 17 alongside this. --*
