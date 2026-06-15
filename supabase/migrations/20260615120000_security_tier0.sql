-- ============================================================
-- Tier-0 security hardening (2026-06-15)
-- Closes three internet-facing holes found in the A3 review
-- (nickdom0923AgentNotes/11 + 12). Safe to re-run (idempotent).
-- Run in: Supabase > SQL Editor > New Query > Run All
-- MUST run AFTER 20260612100000_tenant_scoping.sql (needs
-- is_workspace_member() and workspace_members).
-- ============================================================

-- ============================================================
-- 1. SAFE UUID CAST
-- Storage object paths from the API are `${workspace_id}/bids/...`.
-- The first path segment is the tenant. Casting it to uuid can
-- throw on legacy/garbage paths, which would break a policy
-- predicate, so wrap it in a cast that returns NULL on failure.
-- ============================================================
create or replace function safe_uuid(t text)
returns uuid language plpgsql immutable as $$
begin
  return t::uuid;
exception when others then
  return null;
end;
$$;

-- ============================================================
-- 2. STORAGE RLS: scope the private `documents` bucket by workspace
-- BEFORE: docs_upload/read/select/delete allowed ANY authenticated
-- user to touch ANY object in the bucket (cross-tenant leak of plan
-- documents). The presign route already namespaces new uploads under
-- the workspace id; this enforces it at the database.
--
-- NOTE: objects uploaded BEFORE the workspace-prefix change have a
-- non-uuid first segment (e.g. "bids/...") and will no longer be
-- reachable by the authenticated role (service role still can). If
-- the live bucket has such legacy objects, re-upload them or run a
-- one-time storage move into `${workspace_id}/...` before relying on
-- this. In the sandbox there are typically none.
-- ============================================================
do $$ begin
  -- Remove the permissive bucket-wide policies.
  drop policy if exists "docs_upload" on storage.objects;
  drop policy if exists "docs_read"   on storage.objects;
  drop policy if exists "docs_delete" on storage.objects;
  drop policy if exists "docs_workspace_member" on storage.objects;
end $$;

-- A member of the row's workspace gets full access to that workspace's
-- objects only. Covers select / insert / update / delete via `for all`.
create policy "docs_workspace_member" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'documents'
    and is_workspace_member( safe_uuid((storage.foldername(name))[1]) )
  )
  with check (
    bucket_id = 'documents'
    and is_workspace_member( safe_uuid((storage.foldername(name))[1]) )
  );

-- ============================================================
-- 3. SIGNUP TRIGGER: stop trusting client-supplied role
-- BEFORE: handle_new_user() copied raw_user_meta_data->>'role'
-- into profiles.role, so anyone could sign up as 'admin'. A2 fixed
-- the profile PATCH but not this path. New profiles are now always
-- created with the least-privileged role. Workspace authority lives
-- in workspace_members.role and is assigned via controlled
-- membership/invite logic, never at signup.
-- ============================================================
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    'viewer'  -- least privilege; never read role from user metadata
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Trigger definition unchanged; re-assert idempotently.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
