-- ============================================================
-- AI rate limiting / cost control (2026-07-02) — addresses note-21 finding M5.
-- A per-user, per-route sliding-window log used to throttle the expensive
-- AI endpoints (Opus estimator, plan finder web search, Gmail AI extraction)
-- and to debounce double-clicks that would double-spend.
-- Service-role only: RLS is enabled with NO policies, so the anon/authenticated
-- role has no access; the API writes via the service client (which bypasses RLS).
-- Safe to re-run. Run in: Supabase > SQL Editor > New Query > Run All.
-- ============================================================

create table if not exists ai_rate_limits (
  id           uuid primary key default uuid_generate_v4(),
  workspace_id uuid,
  user_id      uuid not null,
  route        text not null,
  created_at   timestamptz not null default now()
);

create index if not exists ai_rate_limits_lookup
  on ai_rate_limits (user_id, route, created_at desc);

alter table ai_rate_limits enable row level security;
