# 15 — Partner Supabase Handoff (2026-06-15)

**For:** Nick's business partner (NGU Construction co-founder) and the agent acting on their behalf.
**From:** Nick + Claude (Code), working on `feature/a3-tenant-scoping`.
**Why this note:** Nick does not have direct access to the Supabase project connected to the live `ngu-bid-platform.vercel.app` deployment. The partner does. The remaining work on this branch requires changes inside that Supabase project.

This note is self-contained. The acting agent does **not** need prior session context to execute it — but should read `11_CURSOR_A3_REVIEW.md`, `12_CODEX_A3_REVIEW_AND_STRUCTURE.md`, `13_TIER0_SECURITY_FIXES_2026-06-15.md`, and `14_MIDDLEWARE_DECISION_2026-06-15.md` before acting.

---

## Branch state

- Branch: `feature/a3-tenant-scoping`. **Not merged to `main`.** Do not merge until everything below is done and verified.
- Latest local commit (Nick's machine): `2c70a76` — documents the middleware deletion decision. Not yet pushed.
- The branch contains two migrations that depend on each other:
  1. `supabase/migrations/20260612100000_tenant_scoping.sql` — adds `workspaces`, `workspace_members`, `workspace_id` columns + RLS.
  2. `supabase/migrations/20260615120000_security_tier0.sql` — depends on #1's `is_workspace_member()` and `workspace_members`. Closes storage RLS, signup role-metadata escalation, Google OAuth CSRF.

---

## The blocker you must fix before running anything

`20260612100000_tenant_scoping.sql:88-92` currently does this:

```sql
-- All existing users become members of the NGU workspace,
-- carrying over their profile role.
insert into workspace_members (workspace_id, user_id, role)
select ws, id, coalesce(role, 'estimator') from profiles
on conflict (workspace_id, user_id) do nothing;
```

**Both Cursor and Codex flagged this as a Blocker.** Self-signup has been public on the live site, so `profiles` is not a clean list of NGU staff — it contains test accounts, abandoned signups, and any third-party account that happened to sign up. Running this as-written will silently enroll all of them as NGU workspace members with full data access through both RLS and the service-role routes.

### Step 1 — audit who currently has a profile

In Supabase SQL Editor, run:

```sql
select
  p.id,
  u.email,
  u.created_at,
  u.last_sign_in_at,
  p.full_name,
  p.role,
  u.email_confirmed_at is not null as confirmed
from public.profiles p
join auth.users u on u.id = p.id
order by u.created_at;
```

For each row, decide: **is this a real NGU staff account, or not?**

- Real NGU staff: keep. Note their `id` (UUID) — you'll need them in Step 3.
- Test accounts, your own dev signups, anyone you don't recognize: do **not** enroll them. Decide separately whether to delete them from `auth.users` or just leave them unenrolled. (Unenrolled is sufficient for safety — they will have no workspace and therefore no data access after this migration.)

### Step 2 — pick roles for each kept account

Roles, from `workspace_members.role` check constraint:

- `owner` — workspace settings, team, destructive admin. Usually one or two people (you and Nick).
- `admin` — settings/team + normal operations. Trusted seniors.
- `estimator` — create/update bids, estimates, proposals, CRM. The default working role.
- `viewer` — read-only.

### Step 3 — patch the migration before running it

Replace lines 88-92 of `20260612100000_tenant_scoping.sql` with an explicit allowlist. Example shape (do not copy verbatim — fill in real UUIDs and roles from Steps 1–2):

```sql
-- Explicit NGU staff allowlist. Source: partner audit on 2026-06-XX.
-- DO NOT add UUIDs here without confirming the human behind them.
insert into workspace_members (workspace_id, user_id, role) values
  (ws, '<owner-uuid-1>'::uuid,    'owner'),
  (ws, '<owner-uuid-2>'::uuid,    'owner'),
  (ws, '<estimator-uuid>'::uuid,  'estimator')
on conflict (workspace_id, user_id) do nothing;
```

Commit that change as its own small commit on `feature/a3-tenant-scoping` (or a child branch) — message suggestion: `tenant-scoping: replace blanket profile enrollment with explicit NGU allowlist`. Push.

---

## Run order in Supabase

After the migration is patched and pushed:

1. **Back up first.** Supabase Dashboard → Database → Backups → take a manual backup, or use `pg_dump`. Migrations 1 and 2 add NOT NULL columns and replace RLS policies; rolling back without a backup is painful.
2. **Apply `20260612100000_tenant_scoping.sql`.** Either via Supabase SQL Editor (paste contents, run) or `supabase db push` if you use the CLI against this project.
3. **Verify before continuing.** Run:
   ```sql
   select count(*) from workspace_members;            -- should equal your allowlist size
   select count(*) from bids where workspace_id is null;  -- must be 0
   select count(*) from estimates where workspace_id is null;  -- must be 0
   -- repeat for proposals, conversations, documents, companies, contacts, bid_activity
   ```
4. **Apply `20260615120000_security_tier0.sql`.** Same way.
5. **Verify the tier-0 fixes landed.** Run:
   ```sql
   -- Storage policies should now reference is_workspace_member, not just authenticated
   select policyname, qual from pg_policies
   where schemaname = 'storage' and tablename = 'objects';

   -- handle_new_user() should no longer reference raw_user_meta_data->>'role'
   select pg_get_functiondef('public.handle_new_user'::regproc);
   ```
6. **Tell Nick the migrations are applied.** Do not merge the branch to `main` yet — the code in `main` does not stamp `workspace_id` on inserts, so once the migration is live, the production app on `main` will start throwing on every insert. See "Deploy ordering" below.

---

## Deploy ordering (expand / backfill / contract)

Both Cursor and Codex flagged this: **the migration and the code must not be applied in the order "migration first, then code" against a live app.** The current `main` deploy does not write `workspace_id` and will fail every insert as soon as the NOT NULL constraints land.

Safe sequence:

1. Push the patched branch with the allowlist.
2. **Deploy the code first** by merging `feature/a3-tenant-scoping` to `main`. Vercel auto-deploys. New code now expects and stamps `workspace_id` but the DB still allows NULL — that's fine because new code never writes NULL.
3. **Then apply the migrations in Supabase** (steps 2 and 4 above). The backfill fills in `workspace_id` on existing rows; NOT NULL turns on; from this point both sides agree.

If you must do migration first for any reason, **put the live site in maintenance mode** for the gap. Don't leave it live with a write-broken `main`.

---

## What NOT to do

- **Do not restore `middleware.ts`.** It was deleted in commit `4868a80` to fix the Edge `MIDDLEWARE_INVOCATION_FAILED` crash. See `14_MIDDLEWARE_DECISION_2026-06-15.md` for the four conditions any restoration must satisfy. Route-level `requireUser()` is the auth boundary now.
- **Do not run the migration without the allowlist patch.** The blanket profile enrollment is a real data-access leak, not a stylistic concern.
- **Do not skip the backup.** This migration changes RLS policies, NOT NULL constraints, and storage policies. Recovery without a backup is a bad day.
- **Do not merge `feature/a3-tenant-scoping` to `main` before the migration ordering above is sorted.** The two halves only work together.
- **Do not address the remaining A3 blockers in this same PR.** Cross-workspace FK injection, bid-ID redesign, role authority split (between `profiles.role` and `workspace_members.role`), and the `viewer`-can-write RLS issue are all real — but they are separate work, listed at the bottom of `13_TIER0_SECURITY_FIXES_2026-06-15.md` as Tier 1. Get this branch shippable first; layer those in next.

---

## Quick reference

| Need | Where |
|---|---|
| All review findings, severity-ordered | `11_CURSOR_A3_REVIEW.md` |
| Architecture + Part B / Part C proposals | `12_CODEX_A3_REVIEW_AND_STRUCTURE.md` |
| What today's tier-0 commit changed | `13_TIER0_SECURITY_FIXES_2026-06-15.md` |
| Why middleware.ts is deleted | `14_MIDDLEWARE_DECISION_2026-06-15.md` |
| `requireUser()` definition | `lib/auth.ts` |
| Live deploy | `https://ngu-bid-platform.vercel.app` |

---

## Open question back to Nick

If the partner's agent identifies accounts in `auth.users` that look hostile (rather than just test/abandoned), flag those to Nick before deleting. Deletion is reversible only from backup.

*-- Claude (Code), at Nick's direction. --*
