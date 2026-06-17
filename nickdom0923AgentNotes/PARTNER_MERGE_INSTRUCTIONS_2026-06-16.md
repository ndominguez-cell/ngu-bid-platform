# Partner Merge Instructions — Going Live with Tenant Isolation

**For:** the NGU co-founder (holds the Supabase account) and the AI agents acting on your behalf.
**From:** Nick + Claude. **Date:** 2026-06-16.
**Plain-English goal:** turn on the security upgrade that keeps each company's data separate, **without taking the live NGU site down or exposing data.**

---

## The 60-second version

We built a branch called `feature/a3-tenant-scoping` that adds proper "each company sees only its own data" walls (the foundation for ever having a second customer). Turning it on has **two halves that must happen in the right order:**

1. **You** update the database (Supabase). *Only you can do this — Nick doesn't have access.*
2. **Nick** then deploys the new code (Vercel).

**The golden rule: database first, code second.** If the new code goes live before the database is updated, every page that loads data will break (it will look for data tables that don't exist yet and lock everyone out). So we coordinate: you do your part, confirm it worked, then tell Nick to flip the code.

Your agents should read the three technical notes for the details: `18_MERGE_RUNBOOK_2026-06-16.md` (the plan), `15_PARTNER_SUPABASE_HANDOFF_2026-06-15.md` (the Supabase specifics), and `17_TIER1_CHASSIS_HARDENING_PLAN_2026-06-16.md` (what comes after). This file is the action checklist.

---

## Before you touch anything — 3 prerequisites

**1. Decide who the *real* NGU people are (the most important step).**
Because the site allowed open sign-ups for a while, the user list contains test accounts and random strangers, not just your staff. The migration must add **only your actual team** to the NGU workspace — otherwise it would silently give those strangers full access to your bids.

Have your agent run this in **Supabase → SQL Editor** to list everyone:

```sql
select p.id, u.email, u.created_at, u.last_sign_in_at, p.full_name,
       u.email_confirmed_at is not null as confirmed
from public.profiles p
join auth.users u on u.id = p.id
order by u.created_at;
```

Go down the list and mark each one: **real NGU staff (keep) or not (skip).** Write down the `id` (the long UUID) and the right role for each keeper:
- `owner` — you (and Nick). Full control.
- `admin` — trusted senior staff.
- `estimator` — normal staff who create bids/estimates/proposals.
- `viewer` — read-only.

**2. Take a backup.** Supabase → Database → Backups → take a manual backup (or `pg_dump`). This change alters security rules and table columns; a backup is your undo button.

**3. Do NOT run the files in `supabase/setup/`** (the ones named `01_full_setup`, `02_seed_demo_data`, `03_boutique_vertical`, `04_seed_boutique_demo`). Those are for building a fresh practice copy, **not** for your live database. Only run the two migration files named below.

---

## The migration — the recommended simple path (a short maintenance window)

This is the easiest safe path while NGU is the only customer. Pick a quiet time (evening/weekend).

**Step 1 — Patch the staff list into the migration.**
Open `supabase/migrations/20260612100000_tenant_scoping.sql`. Near the bottom (around lines 88–92) there's a block that adds **every** profile as an NGU member. Your agent must replace it with **just your real people** from prerequisite 1. It should look like this (fill in the real UUIDs and roles you wrote down):

```sql
insert into workspace_members (workspace_id, user_id, role) values
  (ws, '<your-owner-uuid>',     'owner'),
  (ws, '<nick-owner-uuid>',     'owner'),
  (ws, '<an-estimator-uuid>',   'estimator')
on conflict (workspace_id, user_id) do update set role = excluded.role;
```

**Step 2 — Put the site in a short maintenance state** (or just accept a few quiet minutes where the app may error).

**Step 3 — Run the two migrations, in order, in Supabase → SQL Editor:**
1. `supabase/migrations/20260612100000_tenant_scoping.sql` (your patched version)
2. `supabase/migrations/20260615120000_security_tier0.sql`

**Step 4 — Verify it worked.** Run these checks; the numbers must match your expectation:

```sql
select count(*) from workspace_members;             -- should equal the number of people you allow-listed
select count(*) from bids where workspace_id is null;       -- must be 0
select count(*) from estimates where workspace_id is null;  -- must be 0
-- repeat for: proposals, conversations, documents, companies, contacts, bid_activity
```

If `workspace_members` is bigger than your list, or any "null" count is not 0 — **stop and tell Nick**; do not proceed.

**Step 5 — Tell Nick: "migration done, verified."** Nick opens a pull request from `feature/a3-tenant-scoping` into `main`, looks at the temporary preview site Vercel generates, and merges. That deploys the new code.

**Step 6 — Final check (together).** Log into the live site as a real NGU account → the dashboard loads → you can see existing bids → you can create a new bid. Take the site out of maintenance. **Done.**

> A zero-downtime version of this (no maintenance window) exists and is described in `18_MERGE_RUNBOOK` as "Option A." It's a bit more work and is worth adopting before your **second** customer. For going live with just NGU, the simple path above is fine.

---

## If something looks wrong

- **Symptom: after the code deploys, the app loads but shows errors / no data / "no workspace assigned."**
  Cause: the code went live but the database step didn't fully take. Fastest fix: tell Nick to **revert the merge** in Vercel (one click — redeploys the previous version), which restores the old working site while you sort out the database. No data is lost by reverting code.
- **Symptom: you see more members than you allow-listed.**
  The staff-list patch (Step 1) didn't take. Restore from your backup and redo Step 1.
- **Anything you're unsure about:** stop and message Nick before running more SQL. Reverting is easy; un-leaking data is not.

---

## What this unlocks (and what's next)

Once this is live, NGU's data is properly walled off — which is the prerequisite for everything else: inviting your own staff with the right permissions, and eventually onboarding a second company. The next build (already planned in `17_TIER1_CHASSIS_HARDENING_PLAN`) adds the **invite system** so you can invite employees by email at a chosen role, instead of open sign-ups. That's the "owner invites their team" feature — it comes right after this merge.

---

*Questions about the *why* behind any of this? Ask your agent to run the teach-the-session prompt Nick is sending alongside this file — it'll walk you through the project in plain language.*
