-- Adds columns required by the July 2026 design revisions:
--  * bids.proposed_start_date  — proposed start date field on bids
--  * estimates.margin_pct      — per-estimate margin (markup already exists)
--  * workspaces default markup/margin — sitewide estimating defaults,
--    used as the starting value on each new estimate

alter table public.bids
  add column if not exists proposed_start_date date;

alter table public.estimates
  add column if not exists margin_pct numeric(5,2) default 8.0;

alter table public.workspaces
  add column if not exists default_markup_pct numeric(5,2) not null default 10.0,
  add column if not exists default_margin_pct numeric(5,2) not null default 8.0;
