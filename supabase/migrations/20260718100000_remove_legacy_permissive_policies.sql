-- ============================================================
-- M1 incident follow-up: remove every known legacy permissive policy.
--
-- On 2026-07-17 the migration directory was pasted into the live SQL editor.
-- The historical bootstrap migration re-created development-era policies that
-- use true for every authenticated user. PostgreSQL combines permissive RLS
-- policies with OR, so those policies bypass workspace-scoped policies even
-- when the correct policies are also present.
--
-- This migration is intentionally drop-only and idempotent. If a scoped policy
-- is missing, the affected table fails closed under RLS rather than reopening
-- cross-workspace access. Review before applying; never batch-run a migration
-- directory against a shared database.
-- ============================================================

-- Names created by 20260101000000_initial_schema.sql.
drop policy if exists "auth_full" on public.bids;
drop policy if exists "auth_full" on public.bid_activity;
drop policy if exists "auth_full" on public.companies;
drop policy if exists "auth_full" on public.contacts;
drop policy if exists "auth_full" on public.documents;
drop policy if exists "auth_full" on public.estimates;
drop policy if exists "auth_full" on public.proposals;
drop policy if exists "auth_full" on public.conversations;
drop policy if exists "read_all" on public.profiles;

-- Names created by the older lib/supabase/schema.sql reference file.
drop policy if exists "Authenticated full access" on public.bids;
drop policy if exists "Authenticated full access" on public.bid_activity;
drop policy if exists "Authenticated full access" on public.companies;
drop policy if exists "Authenticated full access" on public.contacts;
drop policy if exists "Authenticated full access" on public.documents;
drop policy if exists "Authenticated full access" on public.estimates;
drop policy if exists "Authenticated full access" on public.proposals;
drop policy if exists "Authenticated full access" on public.conversations;
drop policy if exists "Users can view all profiles" on public.profiles;

-- Bucket-wide policies created by the initial migration/setup bundle.
drop policy if exists "docs_upload" on storage.objects;
drop policy if exists "docs_read" on storage.objects;
drop policy if exists "docs_delete" on storage.objects;
