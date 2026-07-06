-- ============================================================
-- NGU BID PLATFORM — FULL DATABASE SETUP (run this FIRST)
-- Paste this entire file into: Supabase Dashboard > SQL Editor
--   > New Query > (paste) > Run.
--
-- This builds BOTH layers:
--   1) The reusable multi-tenant CHASSIS (workspaces, members,
--      profiles, auth triggers, row-level security, file storage)
--   2) The construction DOMAIN tables (bids, estimates, etc.) —
--      a reference example you can later swap per business.
--
-- Safe to re-run: every statement is idempotent.
-- Generated 2026-06-13 by combining the two repo migrations.
-- ============================================================

-- ############################################################
-- PART 1 OF 2 — initial_schema (core tables + storage + RLS)
-- ############################################################

-- ============================================================
-- NGU Bid Platform — Full Database Schema + Storage
-- Safe to re-run (idempotent via IF NOT EXISTS / OR REPLACE)
-- Run in: Supabase > SQL Editor > New Query > Run All
-- ============================================================

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ============================================================
-- COMPANIES
-- ============================================================
create table if not exists companies (
  id         uuid primary key default uuid_generate_v4(),
  name       text not null,
  type       text check (type in ('GC','Owner','Architect','Engineer','Subcontractor','Other')) default 'GC',
  website    text,
  phone      text,
  email      text,
  address    text,
  city       text,
  state      text default 'TX',
  notes      text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- CONTACTS
-- ============================================================
create table if not exists contacts (
  id         uuid primary key default uuid_generate_v4(),
  company_id uuid references companies(id) on delete set null,
  first_name text not null,
  last_name  text,
  title      text,
  email      text,
  phone      text,
  mobile     text,
  notes      text,
  source     text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- BIDS
-- ============================================================
create table if not exists bids (
  id                text primary key,
  thread_id         text,
  email_received    date,
  project_name      text not null,
  address           text,
  city              text,
  state             text default 'TX',
  gc_name           text,
  gc_email          text,
  gc_contact_name   text,
  gc_contact_phone  text,
  company_id        uuid references companies(id) on delete set null,
  contact_id        uuid references contacts(id) on delete set null,
  bid_due_date      date,
  bid_due_time      text,
  proposed_start_date date,
  submit_to         text,
  scope             text,
  trades            text[],
  plans_link        text,
  source            text,
  status            text check (status in ('New','Reviewing','Active','Submitted','Won','Lost','Declined','Expired')) default 'New',
  our_bid_amount    numeric(12,2),
  awarded_amount    numeric(12,2),
  notes             text,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

-- ============================================================
-- BID ACTIVITY LOG
-- ============================================================
create table if not exists bid_activity (
  id         uuid primary key default uuid_generate_v4(),
  bid_id     text references bids(id) on delete cascade,
  user_id    uuid references auth.users(id) on delete set null,
  type       text check (type in ('status_change','note','email_sent','call','file_upload','estimate_created','proposal_sent')) not null,
  content    text,
  metadata   jsonb default '{}',
  created_at timestamptz default now()
);

-- ============================================================
-- DOCUMENTS
-- ============================================================
create table if not exists documents (
  id           uuid primary key default uuid_generate_v4(),
  bid_id       text references bids(id) on delete cascade,
  estimate_id  uuid,
  name         text not null,
  type         text check (type in ('plans','specs','addendum','proposal','estimate','other')) default 'other',
  storage_path text not null,
  file_size    bigint,
  mime_type    text,
  uploaded_by  uuid references auth.users(id) on delete set null,
  created_at   timestamptz default now()
);

-- ============================================================
-- ESTIMATES
-- ============================================================
create table if not exists estimates (
  id           uuid primary key default uuid_generate_v4(),
  bid_id       text references bids(id) on delete cascade,
  name         text not null default 'Estimate',
  status       text check (status in ('Draft','In Review','Approved','Submitted','Archived')) default 'Draft',
  total_amount numeric(12,2),
  markup_pct   numeric(5,2) default 10.0,
  margin_pct   numeric(5,2) default 8.0,
  notes        text,
  ai_summary   text,
  line_items   jsonb default '[]',
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- Add FK from documents to estimates (safe re-run)
do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'fk_estimate' and conrelid = 'documents'::regclass
  ) then
    alter table documents add constraint fk_estimate
      foreign key (estimate_id) references estimates(id) on delete set null;
  end if;
end $$;

-- ============================================================
-- PROPOSALS
-- ============================================================
create table if not exists proposals (
  id              uuid primary key default uuid_generate_v4(),
  bid_id          text references bids(id) on delete cascade,
  estimate_id     uuid references estimates(id) on delete set null,
  subject         text not null,
  body_draft      text,
  body_final      text,
  status          text check (status in ('Draft','Reviewed','Sent','Declined')) default 'Draft',
  sent_at         timestamptz,
  sent_by         uuid references auth.users(id) on delete set null,
  gmail_thread_id text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ============================================================
-- CONVERSATIONS
-- ============================================================
create table if not exists conversations (
  id              uuid primary key default uuid_generate_v4(),
  bid_id          text references bids(id) on delete cascade,
  contact_id      uuid references contacts(id) on delete set null,
  gmail_thread_id text,
  subject         text,
  snippet         text,
  direction       text check (direction in ('inbound','outbound')) default 'inbound',
  date            timestamptz,
  created_at      timestamptz default now()
);

-- ============================================================
-- PROFILES (extends auth.users)
-- ============================================================
create table if not exists profiles (
  id                   uuid primary key references auth.users(id) on delete cascade,
  full_name            text,
  title                text,
  avatar_url           text,
  role                 text check (role in ('admin','estimator','viewer')) default 'estimator',
  google_refresh_token text,
  google_access_token  text,
  google_token_expiry  timestamptz,
  gmail_synced_at      timestamptz,
  created_at           timestamptz default now(),
  updated_at           timestamptz default now()
);

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================================
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    coalesce(new.raw_user_meta_data->>'role', 'estimator')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists bids_updated_at      on bids;
create trigger bids_updated_at      before update on bids      for each row execute procedure update_updated_at();
drop trigger if exists estimates_updated_at on estimates;
create trigger estimates_updated_at before update on estimates  for each row execute procedure update_updated_at();
drop trigger if exists proposals_updated_at on proposals;
create trigger proposals_updated_at before update on proposals  for each row execute procedure update_updated_at();
drop trigger if exists companies_updated_at on companies;
create trigger companies_updated_at before update on companies  for each row execute procedure update_updated_at();
drop trigger if exists contacts_updated_at  on contacts;
create trigger contacts_updated_at  before update on contacts   for each row execute procedure update_updated_at();
drop trigger if exists profiles_updated_at  on profiles;
create trigger profiles_updated_at  before update on profiles   for each row execute procedure update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table bids          enable row level security;
alter table bid_activity  enable row level security;
alter table companies     enable row level security;
alter table contacts      enable row level security;
alter table documents     enable row level security;
alter table estimates     enable row level security;
alter table proposals     enable row level security;
alter table conversations enable row level security;
alter table profiles      enable row level security;

-- Full access for authenticated users (adjust per role as needed)
do $$ begin
  if not exists (select 1 from pg_policies where tablename='bids'          and policyname='auth_full') then
    create policy "auth_full" on bids          for all to authenticated using (true) with check (true); end if;
  if not exists (select 1 from pg_policies where tablename='bid_activity'  and policyname='auth_full') then
    create policy "auth_full" on bid_activity  for all to authenticated using (true) with check (true); end if;
  if not exists (select 1 from pg_policies where tablename='companies'     and policyname='auth_full') then
    create policy "auth_full" on companies     for all to authenticated using (true) with check (true); end if;
  if not exists (select 1 from pg_policies where tablename='contacts'      and policyname='auth_full') then
    create policy "auth_full" on contacts      for all to authenticated using (true) with check (true); end if;
  if not exists (select 1 from pg_policies where tablename='documents'     and policyname='auth_full') then
    create policy "auth_full" on documents     for all to authenticated using (true) with check (true); end if;
  if not exists (select 1 from pg_policies where tablename='estimates'     and policyname='auth_full') then
    create policy "auth_full" on estimates     for all to authenticated using (true) with check (true); end if;
  if not exists (select 1 from pg_policies where tablename='proposals'     and policyname='auth_full') then
    create policy "auth_full" on proposals     for all to authenticated using (true) with check (true); end if;
  if not exists (select 1 from pg_policies where tablename='conversations' and policyname='auth_full') then
    create policy "auth_full" on conversations for all to authenticated using (true) with check (true); end if;
  if not exists (select 1 from pg_policies where tablename='profiles'      and policyname='read_all') then
    create policy "read_all"  on profiles for select to authenticated using (true); end if;
  if not exists (select 1 from pg_policies where tablename='profiles'      and policyname='update_own') then
    create policy "update_own" on profiles for update to authenticated using (auth.uid() = id); end if;
  if not exists (select 1 from pg_policies where tablename='profiles'      and policyname='insert_own') then
    create policy "insert_own" on profiles for insert to authenticated with check (auth.uid() = id); end if;
end $$;

-- ============================================================
-- STORAGE BUCKET: "documents" (private, 100MB max)
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  false,
  104857600,
  array['application/pdf','image/png','image/jpeg','image/jpg','image/webp','image/gif','image/heic']
)
on conflict (id) do nothing;

-- Storage RLS
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='docs_upload') then
    create policy "docs_upload" on storage.objects
      for insert to authenticated
      with check (bucket_id = 'documents'); end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='docs_read') then
    create policy "docs_read" on storage.objects
      for select to authenticated
      using (bucket_id = 'documents'); end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='docs_delete') then
    create policy "docs_delete" on storage.objects
      for delete to authenticated
      using (bucket_id = 'documents'); end if;
end $$;

-- ============================================================
-- HELPER FUNCTION: get current user role
-- ============================================================
create or replace function get_user_role()
returns text language sql stable security definer as $$
  select role from public.profiles where id = auth.uid();
$$;


-- ############################################################
-- PART 2 OF 2 — tenant_scoping (workspaces + per-tenant RLS)
-- ############################################################

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
  default_markup_pct numeric(5,2) not null default 10.0,
  default_margin_pct numeric(5,2) not null default 8.0,
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

  -- All existing users become members of the NGU workspace,
  -- carrying over their profile role.
  insert into workspace_members (workspace_id, user_id, role)
  select ws, id, coalesce(role, 'estimator') from profiles
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
