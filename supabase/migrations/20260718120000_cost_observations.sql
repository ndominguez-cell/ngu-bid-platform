-- ============================================================
-- M2 foundation: workspace-private cost observations.
-- File only. Do not apply until the M1 live RLS audit is clean and migration
-- history has been reconciled.
-- Requires private.is_workspace_member(uuid) from M1 advisor hardening.
-- ============================================================

create table if not exists public.cost_observations (
  id                 uuid primary key default uuid_generate_v4(),
  workspace_id       uuid not null references public.workspaces(id) on delete cascade,
  observation_kind   text not null
                       check (observation_kind in (
                         'actual_cost',
                         'approved_estimate',
                         'supplier_quote',
                         'public_bid_price'
                       )),
  source_name        text not null,
  source_ref         text not null,
  source_line_ref    text not null,
  bid_id             text references public.bids(id) on delete set null,
  estimate_id        uuid references public.estimates(id) on delete set null,
  trade              text not null,
  item_key           text not null,
  description        text,
  unit               text not null,
  quantity           numeric(16,4) not null check (quantity > 0),
  unit_cost          numeric(16,4) not null check (unit_cost >= 0),
  region_code        text,
  observed_on        date not null,
  confidence         numeric(4,3) not null default 0.500
                       check (confidence >= 0 and confidence <= 1),
  provenance         jsonb not null default '{}'::jsonb,
  supersedes_id      uuid references public.cost_observations(id) on delete set null,
  created_by         uuid references auth.users(id) on delete set null,
  created_at         timestamptz not null default now(),

  constraint cost_observations_source_line_key unique (
    workspace_id,
    observation_kind,
    source_name,
    source_ref,
    source_line_ref
  )
);

comment on table public.cost_observations is
  'Workspace-private unit-cost evidence with explicit kind and provenance. Never store contact PII, secrets, or bearer URLs in provenance.';
comment on column public.cost_observations.observation_kind is
  'Distinguishes actual cost, reviewed estimate, supplier quote, and public bid price; these meanings must not be silently mixed.';

create index if not exists cost_observations_comparable_idx
  on public.cost_observations (
    workspace_id,
    trade,
    item_key,
    unit,
    observed_on desc
  );
create index if not exists cost_observations_bid_id_idx
  on public.cost_observations(bid_id);
create index if not exists cost_observations_estimate_id_idx
  on public.cost_observations(estimate_id);
create index if not exists cost_observations_created_by_idx
  on public.cost_observations(created_by);
create index if not exists cost_observations_supersedes_id_idx
  on public.cost_observations(supersedes_id);

alter table public.cost_observations enable row level security;

-- Members may inspect their own evidence. All writes go through authenticated,
-- workspace-scoped service-role routes so viewer/writer rules are centralized.
drop policy if exists "cost_observations_member_read" on public.cost_observations;
create policy "cost_observations_member_read" on public.cost_observations
  for select to authenticated
  using (private.is_workspace_member(workspace_id));

revoke all on table public.cost_observations from anon, authenticated;
grant select on table public.cost_observations to authenticated;
grant all on table public.cost_observations to service_role;
