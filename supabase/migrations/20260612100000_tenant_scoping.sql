-- ============================================================
-- Tenant scoping: workspaces + workspace_members + RLS
-- Safe to re-run (idempotent via IF NOT EXISTS / OR REPLACE)
-- Run in: Supabase > SQL Editor > New Query > Run All
--
-- Backfills all existing data into a "NGU Construction" workspace
-- and adds all existing users as members. New self-signups get NO
-- workspace (and therefore no data access) until added to
-- workspace_members — this is intentional.
-- ============================================================

-- ============================================================
-- 1. WORKSPACES + MEMBERS
-- ============================================================
create table if not exists workspaces (
  id         uuid primary key default uuid_generate_v4(),
  name       text not null,
  settings   jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists workspace_members (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id      uuid not null references profiles(id) on delete cascade,
  role         text not null check (role in ('owner','admin','estimator','viewer')) default 'estimator',
  created_at   timestamptz default now(),
  primary key (workspace_id, user_id)
);

drop trigger if exists workspaces_updated_at on workspaces;
create trigger workspaces_updated_at before update on workspaces
  for each row execute procedure update_updated_at();

-- ============================================================
-- 2. HELPER FUNCTIONS (security definer: avoid RLS recursion)
-- ============================================================
create or replace function is_workspace_member(ws uuid)
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = ws and user_id = auth.uid()
  );
$$;

create or replace function shares_workspace_with(target uuid)
returns boolean language sql stable security definer as $$
  select exists (
    select 1
    from public.workspace_members a
    join public.workspace_members b on a.workspace_id = b.workspace_id
    where a.user_id = auth.uid() and b.user_id = target
  );
$$;

-- ============================================================
-- 3. ADD workspace_id TO EVERY BUSINESS TABLE
-- ============================================================
alter table companies     add column if not exists workspace_id uuid references workspaces(id) on delete cascade;
alter table contacts      add column if not exists workspace_id uuid references workspaces(id) on delete cascade;
alter table bids          add column if not exists workspace_id uuid references workspaces(id) on delete cascade;
alter table bid_activity  add column if not exists workspace_id uuid references workspaces(id) on delete cascade;
alter table documents     add column if not exists workspace_id uuid references workspaces(id) on delete cascade;
alter table estimates     add column if not exists workspace_id uuid references workspaces(id) on delete cascade;
alter table proposals     add column if not exists workspace_id uuid references workspaces(id) on delete cascade;
alter table conversations add column if not exists workspace_id uuid references workspaces(id) on delete cascade;

-- ============================================================
-- 4. BACKFILL: everything existing belongs to NGU Construction
-- ============================================================
do $$
declare ws uuid;
begin
  select id into ws from workspaces where name = 'NGU Construction' limit 1;
  if ws is null then
    insert into workspaces (name) values ('NGU Construction') returning id into ws;
  end if;

  update companies     set workspace_id = ws where workspace_id is null;
  update contacts      set workspace_id = ws where workspace_id is null;
  update bids          set workspace_id = ws where workspace_id is null;
  update bid_activity  set workspace_id = ws where workspace_id is null;
  update documents     set workspace_id = ws where workspace_id is null;
  update estimates     set workspace_id = ws where workspace_id is null;
  update proposals     set workspace_id = ws where workspace_id is null;
  update conversations set workspace_id = ws where workspace_id is null;

  -- Explicit NGU staff allowlist. Source: partner audit on 2026-06-17.
  -- DO NOT replace this with a blanket "select * from profiles" enroll --
  -- self-signup has been public, so profiles is not a clean staff list.
  insert into workspace_members (workspace_id, user_id, role) values
    (ws, '1e60fbd9-d928-41a4-9217-76a435836921'::uuid, 'owner'),
    (ws, '9d463d95-cf19-4c1b-94f0-28fd7f3c926f'::uuid, 'estimator')
  on conflict (workspace_id, user_id) do nothing;
end $$;

-- Enforce NOT NULL now that everything is backfilled
alter table companies     alter column workspace_id set not null;
alter table contacts      alter column workspace_id set not null;
alter table bids          alter column workspace_id set not null;
alter table bid_activity  alter column workspace_id set not null;
alter table documents     alter column workspace_id set not null;
alter table estimates     alter column workspace_id set not null;
alter table proposals     alter column workspace_id set not null;
alter table conversations alter column workspace_id set not null;

-- ============================================================
-- 5. INDEXES (every query is now scoped by workspace_id)
-- ============================================================
create index if not exists companies_workspace_idx     on companies(workspace_id);
create index if not exists contacts_workspace_idx      on contacts(workspace_id);
create index if not exists bids_workspace_idx          on bids(workspace_id);
create index if not exists bid_activity_workspace_idx  on bid_activity(workspace_id);
create index if not exists documents_workspace_idx     on documents(workspace_id);
create index if not exists estimates_workspace_idx     on estimates(workspace_id);
create index if not exists proposals_workspace_idx     on proposals(workspace_id);
create index if not exists conversations_workspace_idx on conversations(workspace_id);
create index if not exists workspace_members_user_idx  on workspace_members(user_id);

-- Upsert targets for gmail/sync (were previously unscoped on name/email)
create unique index if not exists companies_workspace_name_key on companies(workspace_id, name);
create unique index if not exists contacts_workspace_email_key on contacts(workspace_id, email);

-- ============================================================
-- 6. RLS: replace permissive auth_full with workspace scoping
-- ============================================================
alter table workspaces        enable row level security;
alter table workspace_members enable row level security;

-- Members can read their own workspace; writes go through service role only.
drop policy if exists "member_read" on workspaces;
create policy "member_read" on workspaces
  for select to authenticated using (is_workspace_member(id));

drop policy if exists "member_read" on workspace_members;
create policy "member_read" on workspace_members
  for select to authenticated using (is_workspace_member(workspace_id));

-- Business tables: full access for members of the row's workspace.
do $$
declare t text;
begin
  foreach t in array array['companies','contacts','bids','bid_activity','documents','estimates','proposals','conversations']
  loop
    execute format('drop policy if exists "auth_full" on %I', t);
    execute format('drop policy if exists "workspace_member_all" on %I', t);
    execute format(
      'create policy "workspace_member_all" on %I for all to authenticated
         using (is_workspace_member(workspace_id))
         with check (is_workspace_member(workspace_id))', t);
  end loop;
end $$;

-- ============================================================
-- 7. PROFILES: close cross-tenant read + self-role-escalation
-- ============================================================
-- Old "read_all" let any authenticated user read every profile
-- (including Google tokens via select *). Scope to shared workspace.
drop policy if exists "read_all" on profiles;
drop policy if exists "read_same_workspace" on profiles;
create policy "read_same_workspace" on profiles
  for select to authenticated
  using (id = auth.uid() or shares_workspace_with(id));

-- Column-level guard: clients may update their own profile (update_own
-- policy, unchanged) but NOT role or Google token columns. The service
-- role (API routes, OAuth callback) is unaffected.
revoke update on table profiles from authenticated;
grant update (full_name, title, avatar_url) on table profiles to authenticated;
