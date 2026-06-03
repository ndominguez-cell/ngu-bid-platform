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
