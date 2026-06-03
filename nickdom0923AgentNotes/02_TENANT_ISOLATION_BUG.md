# 02 — Tenant Isolation Bug & Fix

> **Audience:** the partner, and any AI assistant about to land schema or RLS changes.
> **Author:** Claude (Cowork), at Nick Dominguez's direction, 2026-05-27.
> **Status:** Nick observed the bug live; the diagnosis below is from a read-through of `lib/supabase/schema.sql` and the data-fetching paths. Fix sketch is a proposal, not yet ratified.

---

## 0. Two other security fixes have to come first (added 2026-05-27 after Cursor/Codex review)

After this note was drafted, Cursor (`04`, `05`) and Codex (`06`) independently found two additional security issues that sit *in front of* the tenant-isolation bug. The tenant fix below is still correct and still necessary, but it is not the first thing to land:

1. **Self-role escalation through `/api/profile`** (Cursor `05` §A.1). Any signed-in user can PATCH `role: 'admin'` onto their own profile. Fix is one line: drop `role` from the writable fields on that endpoint. This is independent of everything in §1–§6 below and should ship immediately.
2. **Unauthenticated `/api/*` access with service-role bypass** (Cursor `04` §1, `06` §4.1). `middleware.ts` marks `/api/*` public, and several routes (`/api/bids`, `/api/bids/[id]`, `/api/estimates`, `/api/proposals/draft`) use `createServiceClient()` without verifying `auth.getUser()`. This means the data-exposure surface is wider than what's described in §1 below — *anyone* on the public internet can read/write bids, not just any logged-in user. The fix is a shared `requireUserContext()` helper used by every route. Until that lands, the workspace policies in §3 don't fully bind, because routes using the service-role client bypass RLS entirely.

The sequencing therefore is:

1. Drop `role` from `/api/profile`. (~5 min)
2. Add `requireUserContext()` and convert every API route to call it; switch service-role usage to request-scoped where appropriate. (~half day)
3. Then everything in §1–§6 of this note: workspaces, membership, RLS rewrites, backfill, signup change. (~half to one day)

Acceptance criteria in §5 are updated to reflect that *both* an unauthenticated and a cross-tenant-authenticated probe must fail.

---

## 1. The observation

Nick was sent the live URL by the partner. Nick created a brand-new account, verified email, signed in. The dashboard and `/bids` page rendered **all 29 of NGU Construction's existing bids** — project names, GCs, due dates, dollar amounts, statuses. Nick had never been invited to NGU's workspace (there is no concept of "NGU's workspace" in the current schema) and had never interacted with any of those bids.

The expected behavior for a fresh signup is an empty dashboard with zero bids.

## 2. Three-layer diagnosis

The current behavior is not caused by a single broken line — it's the consequence of three design choices stacking. Any one of them on its own would be defensible; all three together produce "any authenticated user sees everything."

### Layer 1 — The schema has no tenancy column

`lib/supabase/schema.sql`, every domain table: `bids`, `companies`, `contacts`, `estimates`, `proposals`, `documents`, `bid_activity`, `conversations`. None of them have a `workspace_id`, `org_id`, `tenant_id`, or `owner_user_id` column. The `bids` table tracks who the bid is *for* (GC, contact) and who *created* nothing — there is no column the database could filter on to answer "which company in our system does this row belong to?"

This is a coherent v1 design *if* the assumption is "the only people who will ever log into this deployment are NGU's estimators." That assumption broke the moment a non-NGU user (Nick) was given the URL.

### Layer 2 — The RLS policy is `using (true)`

Same file, the RLS block:

```sql
alter table bids enable row level security;
-- ...
create policy "Authenticated full access" on bids
  for all to authenticated using (true) with check (true);
```

The same policy is applied to `bid_activity`, `companies`, `contacts`, `documents`, `estimates`, `proposals`, and `conversations`. RLS is *on* — which is good defense in depth — but the policy that's on is "permit everything for any logged-in user." With Layer 1, there is no `workspace_id` to filter on anyway; the policy couldn't be tighter without a schema change.

### Layer 3 — Page fetches and API routes don't scope

The `bids` list page (`app/(app)/bids/page.tsx`):

```ts
async function getBids(): Promise<Bid[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from('bids')
    .select('*')
    .order('bid_due_date', { ascending: true, nullsFirst: false });
  return (data ?? []) as Bid[];
}
```

The `bids` list API (`app/api/bids/route.ts`):

```ts
export async function GET() {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('bids')
    .select('*')
    .order('bid_due_date', { ascending: true, nullsFirst: false });
  // ...
}
```

Neither call filters by user, workspace, or any other ownership predicate. The page-level call uses the request-scoped client (which respects RLS) but RLS is permissive, so it returns everything. The API-level call uses the **service-role client**, which bypasses RLS entirely — so even if RLS were tight, this endpoint would still return every row. The dashboard, analytics, bid-detail, and CRM pages all follow the same `select('*')` pattern.

### Net effect

A new user signs up → auto-create-profile trigger fires → middleware lets them past `/dashboard` → page calls `supabase.from('bids').select('*')` → RLS approves (`using (true)`) → the user sees every bid. Nothing went wrong. There is nothing in the system that *could* have separated them.

## 3. Fix sketch

The fix is the same multi-tenant pattern documented in the sibling repo's [`project_mc_architecture` memory](https://github.com/nickdom0923/Aios-Missioncontrol) — and importantly, doing it here also unlocks the Stage 3 direction in [`00_SCOPE_AND_GOALS.md`](./00_SCOPE_AND_GOALS.md). One change, two payoffs.

### 3.1 Schema changes

Two new tables and a column on every domain table:

```sql
create table workspaces (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  slug        text unique not null,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz default now()
);

create table workspace_members (
  workspace_id uuid references workspaces(id) on delete cascade,
  user_id      uuid references auth.users(id) on delete cascade,
  role         text check (role in ('owner','admin','estimator','viewer')) default 'estimator',
  invited_by   uuid references auth.users(id) on delete set null,
  joined_at    timestamptz default now(),
  primary key (workspace_id, user_id)
);

alter table bids          add column workspace_id uuid references workspaces(id) on delete cascade;
alter table companies     add column workspace_id uuid references workspaces(id) on delete cascade;
alter table contacts      add column workspace_id uuid references workspaces(id) on delete cascade;
alter table estimates     add column workspace_id uuid references workspaces(id) on delete cascade;
alter table proposals     add column workspace_id uuid references workspaces(id) on delete cascade;
alter table documents     add column workspace_id uuid references workspaces(id) on delete cascade;
alter table bid_activity  add column workspace_id uuid references workspaces(id) on delete cascade;
alter table conversations add column workspace_id uuid references workspaces(id) on delete cascade;

create index on bids(workspace_id);
create index on companies(workspace_id);
-- etc for the others
```

After the backfill in §3.4, every `workspace_id` becomes `not null`.

### 3.2 Helper function

```sql
create or replace function get_workspaces_for_user()
returns setof uuid
language sql
stable
security definer
as $$
  select workspace_id
  from workspace_members
  where user_id = auth.uid();
$$;
```

### 3.3 RLS rewrites

Drop the permissive policies and replace with workspace-scoped ones. Example for `bids`; same shape for every other domain table:

```sql
drop policy if exists "Authenticated full access" on bids;

create policy "Workspace members read"   on bids for select to authenticated
  using (workspace_id in (select get_workspaces_for_user()));

create policy "Workspace members insert" on bids for insert to authenticated
  with check (workspace_id in (select get_workspaces_for_user()));

create policy "Workspace members update" on bids for update to authenticated
  using (workspace_id in (select get_workspaces_for_user()))
  with check (workspace_id in (select get_workspaces_for_user()));

create policy "Workspace members delete" on bids for delete to authenticated
  using (workspace_id in (select get_workspaces_for_user()));
```

For `workspaces` itself: members can read their workspaces; only the `created_by` user can update or delete. For `workspace_members`: members can read other members of their workspaces; only `owner`/`admin` roles can insert/update/delete.

### 3.4 Backfill the existing 29 bids

Run **once** in Supabase SQL Editor, with the partner's `auth.users.id` (call it `:partner_uid`):

```sql
-- 1. Create NGU's workspace owned by the partner
insert into workspaces (name, slug, created_by)
values ('NGU Construction', 'ngu-construction', :partner_uid)
returning id;  -- copy the returned id, call it :ngu_workspace_id

-- 2. Make the partner the workspace owner
insert into workspace_members (workspace_id, user_id, role)
values (:ngu_workspace_id, :partner_uid, 'owner');

-- 3. Stamp every existing row with the NGU workspace
update bids          set workspace_id = :ngu_workspace_id;
update companies     set workspace_id = :ngu_workspace_id;
update contacts      set workspace_id = :ngu_workspace_id;
update estimates     set workspace_id = :ngu_workspace_id;
update proposals     set workspace_id = :ngu_workspace_id;
update documents     set workspace_id = :ngu_workspace_id;
update bid_activity  set workspace_id = :ngu_workspace_id;
update conversations set workspace_id = :ngu_workspace_id;

-- 4. Now make workspace_id required
alter table bids          alter column workspace_id set not null;
alter table companies     alter column workspace_id set not null;
-- etc.

-- 5. Add the partner's existing teammates if any have already signed up
-- (manually for now; the invite UI comes later)
insert into workspace_members (workspace_id, user_id, role)
values (:ngu_workspace_id, :teammate_uid, 'estimator');
```

### 3.5 Signup flow change

Update `handle_new_user()` (or add a sibling trigger / call it from a signup API route) so that whenever a new `auth.users` row is created and the user is *not* already a member of any workspace via invitation, a new empty workspace is created with them as owner:

```sql
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
declare
  new_workspace_id uuid;
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');

  -- Only create a new workspace if the user wasn't invited into one
  -- (invitation flow would insert workspace_members before signup completes)
  if not exists (
    select 1 from public.workspace_members where user_id = new.id
  ) then
    insert into public.workspaces (name, slug, created_by)
    values (
      coalesce(new.raw_user_meta_data->>'company_name', 'My Workspace'),
      'ws-' || substr(new.id::text, 1, 8),
      new.id
    )
    returning id into new_workspace_id;

    insert into public.workspace_members (workspace_id, user_id, role)
    values (new_workspace_id, new.id, 'owner');
  end if;

  return new;
end;
$$;
```

### 3.6 Application-layer changes

Mostly small. Two patterns:

1. **A `getActiveWorkspaceId(user)` helper** in `lib/supabase/server.ts` that returns the current workspace for the request. For now: the user's first/only workspace. Later: stored in a cookie or `profiles.active_workspace_id` for users with multiple workspaces.
2. **Every `INSERT` stamps `workspace_id`.** Audit-grep the codebase for `.insert(` and add `workspace_id` to each. Most are in API routes; a few are in server components.

`SELECT` calls don't need changes if they go through the request-scoped Supabase client (RLS will filter automatically). The current uses of `createServiceClient()` in routes like `app/api/bids/route.ts` GET should switch to `createClient()` *or* add an explicit `.eq('workspace_id', activeWorkspaceId)` so the service-role bypass doesn't leak cross-tenant data.

The `nextBidId()` function in `app/api/gmail/detect-bids/route.ts` should scope its `like` query to the active workspace so two workspaces don't end up fighting over `BID-2026-001`.

## 4. Rollout sequencing

A safe order — each step is reversible, none break the running app for the partner mid-deploy.

1. **Snapshot the production database.** Supabase → Database → Backups. Easy rollback if anything in §2–§4 goes wrong.
2. Apply §3.1 schema additions on a Supabase branch (or a staging project). The `add column` is nullable, so it does not break existing inserts.
3. Apply §3.4 backfill on staging, confirm row counts match.
4. Apply §3.2 + §3.3 RLS rewrites on staging.
5. Apply §3.5 signup trigger change on staging.
6. Deploy the §3.6 app changes to a Vercel preview that points at the staging Supabase.
7. **Acceptance test:** sign up a fresh account on the preview, confirm the dashboard is empty. Sign in as the partner, confirm NGU's bids are still there.
8. Promote: apply §3.1–§3.5 to production (in the same order, partner online to verify after each), then deploy the §3.6 app changes.
9. Delete Nick's existing test account (so its accidentally-created workspace doesn't litter the table).

## 5. Acceptance criteria

Before this can be considered done:

- **Unauthenticated** `GET /api/bids`, `POST /api/bids`, `GET /api/bids/[id]`, `POST /api/estimates`, and `POST /api/proposals/draft` all return `401`. (This is mainly enforced by the §0 fix, but worth re-verifying after the §3 work lands.)
- A brand-new signup sees an empty dashboard, empty bids list, empty CRM, empty everything.
- The partner (signed in as the NGU workspace owner) sees the same 29 bids as before, plus all related estimates, proposals, contacts, companies, documents, and conversations.
- A user in workspace A who manually constructs the URL `/bids/BID-2026-001` for a bid in workspace B gets a 404 / not-found, not the bid contents.
- A user in workspace A calling `GET /api/bids/BID-2026-001` for a bid in workspace B gets a 404, not the bid JSON. (Important because §0 #2 mid-state may leave some routes still using service-role even after RLS is tight.)
- An attempt to `INSERT` a `bid` without a `workspace_id` fails at the database level (because the column is now `not null`).
- A non-admin user PATCHing `/api/profile` with `{role: 'admin'}` does NOT update their role. (§0 #1 acceptance.)
- The plan-finder, estimate generator, proposal drafter, and Gmail sync routes continue to work for the partner and produce rows tagged with NGU's workspace_id.

## 6. What this fix does and does not do

**Does:**
- Closes the immediate exposure where a non-NGU user could see NGU's data.
- Puts the schema in the right shape for Stage 3 (Nick's SaaS thesis in `00`) without changes — at that point the only new work is the invite-UI flow and a workspace-switcher in the UI.
- Sets up the data model needed for Stage 3+ aggregate analytics (every row knows which company it belongs to).

**Does not:**
- Add an invite UI for the partner to invite teammates by email. That's a follow-up feature (probably one new page + one new API route + Supabase Auth's email invite endpoint).
- Address per-role permissions inside a workspace (admin vs estimator vs viewer). The role column exists on `workspace_members`; per-role policy refinements can layer on top of the workspace policy once the workspace-scoping is solid.
- Address billing, plans, or workspace limits. Those are Stage 3 product decisions, not security fixes.
- Address shared-email-domain auto-join (e.g., "anyone with an @nguconstruction.com email auto-joins NGU workspace"). That's a nice onboarding affordance but the security model should be invitation-first; domain-auto-join can layer on as an opt-in per workspace.

---

*Drafted 2026-05-27 by Claude (Cowork). Updated 2026-05-27 after Cursor's two debug passes (`04`, `05`) and Codex's repo read (`06`) — added §0 to sequence two prerequisite fixes (self-role escalation, unauthenticated API access) in front of the tenant work, and expanded §5 acceptance criteria to cover both. Ratification and implementation pending the partner's review.*
