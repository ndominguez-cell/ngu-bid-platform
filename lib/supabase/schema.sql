-- LEGACY REFERENCE ONLY — DO NOT EXECUTE.
-- This file contains historical permissive RLS examples. Current schema
-- changes belong in supabase/migrations/. See supabase/README.md.
-- ============================================================
-- NGU Bid Platform — Supabase Database Schema
-- Run this in Supabase > SQL Editor > New Query
-- ============================================================

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ============================================================
-- COMPANIES (GCs, owners, architects, engineers)
-- ============================================================
create table if not exists companies (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  type        text check (type in ('GC','Owner','Architect','Engineer','Subcontractor','Other')) default 'GC',
  website     text,
  phone       text,
  email       text,
  address     text,
  city        text,
  state       text default 'TX',
  notes       text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ============================================================
-- CONTACTS (people at companies)
-- ============================================================
create table if not exists contacts (
  id           uuid primary key default uuid_generate_v4(),
  company_id   uuid references companies(id) on delete set null,
  first_name   text not null,
  last_name    text,
  title        text,
  email        text,
  phone        text,
  mobile       text,
  notes        text,
  source       text,  -- 'gmail', 'plans', 'manual'
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- ============================================================
-- BIDS (main bid tracking table — migrated from bids.json)
-- ============================================================
create table if not exists bids (
  id                text primary key,  -- BID-2026-001 format
  thread_id         text,              -- Gmail thread ID
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
  submit_to         text,
  scope             text,
  trades            text[],            -- array of trade names
  plans_link        text,
  source            text,              -- 'PlanHub','Procore','Novel','Direct'
  status            text check (status in ('New','Reviewing','Active','Submitted','Won','Lost','Declined','Expired')) default 'New',
  our_bid_amount    numeric(12,2),
  awarded_amount    numeric(12,2),
  notes             text,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

-- ============================================================
-- BID ACTIVITY LOG (status changes, notes, calls)
-- ============================================================
create table if not exists bid_activity (
  id          uuid primary key default uuid_generate_v4(),
  bid_id      text references bids(id) on delete cascade,
  user_id     uuid references auth.users(id) on delete set null,
  type        text check (type in ('status_change','note','email_sent','call','file_upload','estimate_created','proposal_sent')) not null,
  content     text,
  metadata    jsonb default '{}',
  created_at  timestamptz default now()
);

-- ============================================================
-- DOCUMENTS (plans, specs, attachments)
-- ============================================================
create table if not exists documents (
  id            uuid primary key default uuid_generate_v4(),
  bid_id        text references bids(id) on delete cascade,
  estimate_id   uuid,  -- set after estimates table created
  name          text not null,
  type          text check (type in ('plans','specs','addendum','proposal','estimate','other')) default 'other',
  storage_path  text not null,   -- Supabase Storage path
  file_size     bigint,
  mime_type     text,
  uploaded_by   uuid references auth.users(id) on delete set null,
  created_at    timestamptz default now()
);

-- ============================================================
-- ESTIMATES
-- ============================================================
create table if not exists estimates (
  id              uuid primary key default uuid_generate_v4(),
  bid_id          text references bids(id) on delete cascade,
  name            text not null default 'Estimate',
  status          text check (status in ('Draft','In Review','Approved','Submitted','Archived')) default 'Draft',
  total_amount    numeric(12,2),
  markup_pct      numeric(5,2) default 10.0,
  notes           text,
  ai_summary      text,   -- Claude's takeoff summary
  line_items      jsonb default '[]',  -- [{trade, description, qty, unit, unit_price, total}]
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- Add FK back to documents (safe re-run)
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
  body_draft      text,     -- Claude-generated email body
  body_final      text,     -- Edited final version
  status          text check (status in ('Draft','Reviewed','Sent','Declined')) default 'Draft',
  sent_at         timestamptz,
  sent_by         uuid references auth.users(id) on delete set null,
  gmail_thread_id text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ============================================================
-- CONVERSATIONS (email threads linked to bids/contacts)
-- ============================================================
create table if not exists conversations (
  id            uuid primary key default uuid_generate_v4(),
  bid_id        text references bids(id) on delete cascade,
  contact_id    uuid references contacts(id) on delete set null,
  gmail_thread_id text,
  subject       text,
  snippet       text,
  direction     text check (direction in ('inbound','outbound')) default 'inbound',
  date          timestamptz,
  created_at    timestamptz default now()
);

-- ============================================================
-- USER PROFILES (extra info beyond Supabase auth.users)
-- ============================================================
create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  title       text,
  avatar_url  text,
  role        text check (role in ('admin','estimator','viewer')) default 'estimator',
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- Auto-create profile on user signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists bids_updated_at on bids;
create trigger bids_updated_at before update on bids
  for each row execute procedure update_updated_at();
drop trigger if exists estimates_updated_at on estimates;
create trigger estimates_updated_at before update on estimates
  for each row execute procedure update_updated_at();
drop trigger if exists proposals_updated_at on proposals;
create trigger proposals_updated_at before update on proposals
  for each row execute procedure update_updated_at();
drop trigger if exists companies_updated_at on companies;
create trigger companies_updated_at before update on companies
  for each row execute procedure update_updated_at();
drop trigger if exists contacts_updated_at on contacts;
create trigger contacts_updated_at before update on contacts
  for each row execute procedure update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY (all authenticated users can read/write)
-- ============================================================
alter table bids enable row level security;
alter table bid_activity enable row level security;
alter table companies enable row level security;
alter table contacts enable row level security;
alter table documents enable row level security;
alter table estimates enable row level security;
alter table proposals enable row level security;
alter table conversations enable row level security;
alter table profiles enable row level security;

-- Policy: any authenticated user can do everything (adjust per role later)
do $$ begin
  if not exists (select 1 from pg_policies where tablename='bids' and policyname='Authenticated full access') then
    create policy "Authenticated full access" on bids for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='bid_activity' and policyname='Authenticated full access') then
    create policy "Authenticated full access" on bid_activity for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='companies' and policyname='Authenticated full access') then
    create policy "Authenticated full access" on companies for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='contacts' and policyname='Authenticated full access') then
    create policy "Authenticated full access" on contacts for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='documents' and policyname='Authenticated full access') then
    create policy "Authenticated full access" on documents for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='estimates' and policyname='Authenticated full access') then
    create policy "Authenticated full access" on estimates for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='proposals' and policyname='Authenticated full access') then
    create policy "Authenticated full access" on proposals for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='conversations' and policyname='Authenticated full access') then
    create policy "Authenticated full access" on conversations for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='profiles' and policyname='Users can view all profiles') then
    create policy "Users can view all profiles" on profiles for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='profiles' and policyname='Users can update own profile') then
    create policy "Users can update own profile" on profiles for update to authenticated using (auth.uid() = id);
  end if;
end $$;

-- ============================================================
-- PHASE 2 MIGRATION — Gmail OAuth token storage
-- Run in Supabase > SQL Editor after Phase 1 schema is applied
-- ============================================================
alter table profiles add column if not exists google_refresh_token text;
alter table profiles add column if not exists google_access_token text;
alter table profiles add column if not exists google_token_expiry timestamptz;
alter table profiles add column if not exists gmail_synced_at timestamptz;

-- ============================================================
-- PHASE 3 MIGRATION — Role-based RLS policies
-- Run in Supabase > SQL Editor after Phase 2 schema is applied
-- ============================================================

-- Helper function: get current user's role from profiles
create or replace function get_user_role()
returns text language sql stable security definer as $$
  select role from public.profiles where id = auth.uid();
$$;

-- Viewers can only read bids (not write)
-- Drop the blanket "Authenticated full access" for bids and replace with role-aware policies
-- NOTE: only run these if you want strict role enforcement; the default "Authenticated full access"
-- policy already works for small teams. Uncomment to enable:

-- drop policy if exists "Authenticated full access" on bids;
-- create policy "Bids read" on bids for select to authenticated using (true);
-- create policy "Bids write" on bids for insert to authenticated
--   with check (get_user_role() in ('admin','estimator'));
-- create policy "Bids update" on bids for update to authenticated
--   using (true) with check (get_user_role() in ('admin','estimator'));
-- create policy "Bids delete" on bids for delete to authenticated
--   using (get_user_role() = 'admin');

-- ============================================================
-- SUPABASE STORAGE BUCKET
-- Run separately in Supabase > Storage > New Bucket
-- Name: "documents", Public: false
-- ============================================================
