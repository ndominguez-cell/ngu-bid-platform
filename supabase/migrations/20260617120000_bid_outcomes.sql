-- ============================================================
-- Bid outcomes: close the win/loss feedback loop (2026-06-17)
-- The loop was open — nothing recorded WHY a bid was won/lost or
-- WHEN it was decided. The outcome classes (Won/Lost/Declined/
-- Expired) and the amounts (our_bid_amount, awarded_amount)
-- already exist on `bids`; this adds the two missing signal fields.
-- Safe to re-run (idempotent). Run in: Supabase > SQL Editor.
-- Requires 20260612100000_tenant_scoping.sql (workspace_id + RLS).
-- ============================================================

alter table bids add column if not exists loss_reason text;
alter table bids add column if not exists decided_at  timestamptz;

-- Backfill decided_at for bids already in a terminal state so historical
-- win-rate math has a timestamp to work with (updated_at as a proxy).
update bids
set decided_at = coalesce(decided_at, updated_at)
where status in ('Won','Lost','Declined','Expired')
  and decided_at is null;

-- Outcome analytics always filter by workspace + status (and by decision
-- date for cycle-time / trend). Index both access paths.
create index if not exists bids_workspace_status_idx  on bids(workspace_id, status);
create index if not exists bids_workspace_decided_idx on bids(workspace_id, decided_at);

-- No RLS change: the existing workspace_member_all policy on `bids` already
-- governs these new columns, and status's CHECK already allows the outcome
-- values. No new grants required.
