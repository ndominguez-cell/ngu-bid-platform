-- ============================================================
-- M1 advisor hardening (2026-07-17)
-- File-only handoff: partner must review before applying.
-- Run after 20260716120000_workspace_invitations.sql.
-- ============================================================

-- ============================================================
-- 1. MOVE SECURITY DEFINER HELPERS OUT OF THE EXPOSED API SCHEMA
--
-- ALTER ... SET SCHEMA preserves each function's object identity. PostgreSQL
-- therefore keeps every dependent RLS policy attached to the same function
-- while its qualified name becomes private.*. The private schema must remain
-- excluded from Supabase's exposed API schemas. Authenticated receives USAGE
-- and EXECUTE only so RLS predicates can evaluate; /rest/v1/rpc cannot expose
-- functions from a schema that PostgREST does not expose.
-- ============================================================
create schema if not exists private;
comment on schema private is
  'Internal database helpers. Keep this schema out of Supabase exposed API schemas.';

revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

do $$
begin
  if to_regprocedure('public.get_user_role()') is not null then
    alter function public.get_user_role() set schema private;
  end if;
  if to_regprocedure('public.is_workspace_member(uuid)') is not null then
    alter function public.is_workspace_member(uuid) set schema private;
  end if;
  if to_regprocedure('public.shares_workspace_with(uuid)') is not null then
    alter function public.shares_workspace_with(uuid) set schema private;
  end if;
end $$;

create or replace function private.get_user_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role
  from public.profiles
  where id = (select auth.uid());
$$;

create or replace function private.is_workspace_member(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members
    where workspace_id = ws
      and user_id = (select auth.uid())
  );
$$;

create or replace function private.shares_workspace_with(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members a
    join public.workspace_members b on a.workspace_id = b.workspace_id
    where a.user_id = (select auth.uid())
      and b.user_id = target
  );
$$;

revoke all on function private.get_user_role() from public, anon;
revoke all on function private.is_workspace_member(uuid) from public, anon;
revoke all on function private.shares_workspace_with(uuid) from public, anon;
grant execute on function private.get_user_role() to authenticated, service_role;
grant execute on function private.is_workspace_member(uuid) to authenticated, service_role;
grant execute on function private.shares_workspace_with(uuid) to authenticated, service_role;

-- Recreate the profiles policies both to make the private reference explicit
-- and to make auth.uid() an initplan instead of evaluating it per row.
drop policy if exists "update_own" on public.profiles;
create policy "update_own" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "insert_own" on public.profiles;
create policy "insert_own" on public.profiles
  for insert to authenticated
  with check ((select auth.uid()) = id);

drop policy if exists "read_same_workspace" on public.profiles;
create policy "read_same_workspace" on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or private.shares_workspace_with(id)
  );

-- ============================================================
-- 2. EXPLICIT SERVICE-ROLE-ONLY POLICIES
--
-- The service role bypasses RLS. These deny-all marker policies make the
-- intended anon/authenticated behavior visible to reviewers and advisors.
-- auto_leads is live-database drift and is not yet in the migration history,
-- so guard that policy with to_regclass for clean local rebuilds.
-- ============================================================
comment on table public.ai_rate_limits is
  'Service-role-only AI usage log. Anon and authenticated access is denied by RLS.';
drop policy if exists "service_role_only_deny_all" on public.ai_rate_limits;
create policy "service_role_only_deny_all" on public.ai_rate_limits
  for all to anon, authenticated
  using (false)
  with check (false);
comment on policy "service_role_only_deny_all" on public.ai_rate_limits is
  'Marker policy: application access must use the service role.';

do $$
begin
  if to_regclass('public.auto_leads') is not null then
    comment on table public.auto_leads is
      'Service-role-only lead intake table. Anon and authenticated access is denied by RLS.';
    drop policy if exists "service_role_only_deny_all" on public.auto_leads;
    create policy "service_role_only_deny_all" on public.auto_leads
      for all to anon, authenticated
      using (false)
      with check (false);
    comment on policy "service_role_only_deny_all" on public.auto_leads is
      'Marker policy: application access must use the service role.';
  end if;
end $$;

-- ============================================================
-- 3. INVITATION ROLE DEFENSE IN DEPTH
-- Ownership is assigned only at workspace creation/backfill, never by invite.
-- ============================================================
alter table public.workspace_invitations
  drop constraint if exists workspace_invitations_role_check;
alter table public.workspace_invitations
  add constraint workspace_invitations_role_check
  check (role in ('admin', 'estimator', 'viewer'));

-- ============================================================
-- 4. COVER ALL 17 ADVISOR-REPORTED UNINDEXED FOREIGN KEYS
-- ============================================================
create index if not exists bid_activity_bid_id_idx
  on public.bid_activity(bid_id);
create index if not exists bid_activity_user_id_idx
  on public.bid_activity(user_id);

create index if not exists bids_company_id_idx
  on public.bids(company_id);
create index if not exists bids_contact_id_idx
  on public.bids(contact_id);

create index if not exists contacts_company_id_idx
  on public.contacts(company_id);

create index if not exists conversations_bid_id_idx
  on public.conversations(bid_id);
create index if not exists conversations_contact_id_idx
  on public.conversations(contact_id);

create index if not exists documents_bid_id_idx
  on public.documents(bid_id);
create index if not exists documents_uploaded_by_idx
  on public.documents(uploaded_by);
create index if not exists documents_estimate_id_idx
  on public.documents(estimate_id);

create index if not exists estimates_bid_id_idx
  on public.estimates(bid_id);
create index if not exists estimates_created_by_idx
  on public.estimates(created_by);

create index if not exists proposals_bid_id_idx
  on public.proposals(bid_id);
create index if not exists proposals_estimate_id_idx
  on public.proposals(estimate_id);
create index if not exists proposals_sent_by_idx
  on public.proposals(sent_by);

create index if not exists workspace_invitations_accepted_by_idx
  on public.workspace_invitations(accepted_by);
create index if not exists workspace_invitations_invited_by_idx
  on public.workspace_invitations(invited_by);
