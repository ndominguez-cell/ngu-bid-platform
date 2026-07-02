-- ============================================================
-- Security follow-ups (2026-07-02) — addresses findings in
-- nickdom0923AgentNotes/21_SECURITY_REVIEW_2026-07-02.md.
-- Safe to re-run. Run in: Supabase > SQL Editor > New Query > Run All.
-- MUST run AFTER 20260612100000_tenant_scoping.sql.
-- ============================================================

-- ============================================================
-- H1. Stop workspace teammates reading each other's Google tokens.
-- The tier-0 work added column-level UPDATE grants on profiles but left
-- SELECT wide open, so any workspace member could read a coworker's
-- google_refresh_token / google_access_token via the anon key and gain
-- durable access to their Gmail. Restrict SELECT to non-sensitive columns.
-- The service role (API routes, OAuth callback, lib/gmail) is unaffected.
--
-- The read_same_workspace RLS policy still governs WHICH rows are visible;
-- these column grants govern WHICH columns the authenticated role may read.
-- ============================================================
revoke select on table profiles from authenticated;
grant select (id, full_name, title, avatar_url, role, gmail_synced_at, created_at, updated_at)
  on table profiles to authenticated;

-- ============================================================
-- L6. Proposal double-send guard needs a transient 'Sending' status so the
-- send route can atomically claim a proposal before calling Gmail. Widen the
-- status check constraint to allow it.
-- ============================================================
alter table proposals drop constraint if exists proposals_status_check;
alter table proposals
  add constraint proposals_status_check
  check (status in ('Draft', 'Reviewed', 'Sent', 'Declined', 'Sending'));
