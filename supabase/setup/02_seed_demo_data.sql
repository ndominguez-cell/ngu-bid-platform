-- ============================================================
-- NGU BID PLATFORM — DEMO SEED DATA (run this SECOND)
-- Paste into: Supabase Dashboard > SQL Editor > New Query > Run.
--
-- IMPORTANT — order matters:
--   1. Run 01_full_setup.sql first.
--   2. Sign up for an account in the app (so your user/profile exists).
--   3. THEN run this file. It attaches your account to the demo
--      workspace so the data is actually visible (row-level security
--      hides any workspace you are not a member of).
--
-- Safe to re-run: it reuses the demo workspace instead of duplicating.
-- This seeds the CONSTRUCTION reference domain so you can confirm the
-- platform works end to end. Boutique data will be a separate file.
-- ============================================================

do $$
declare
  ws   uuid;
  c1   uuid;
  c2   uuid;
  ct1  uuid;
  uid  uuid;
begin
  -- ---- Demo workspace (reuse if it already exists) ----
  select id into ws from workspaces where name = 'NGU Construction (Demo)' limit 1;
  if ws is null then
    insert into workspaces (name) values ('NGU Construction (Demo)') returning id into ws;
  end if;

  -- ---- Companies ----
  insert into companies (workspace_id, name, type, city, state, email, phone)
  values (ws, 'Lone Star General Contractors', 'GC', 'Austin', 'TX', 'bids@lonestargc.com', '512-555-0100')
  on conflict (workspace_id, name) do update set updated_at = now()
  returning id into c1;

  insert into companies (workspace_id, name, type, city, state)
  values (ws, 'Hill Country Property Owners', 'Owner', 'San Antonio', 'TX')
  on conflict (workspace_id, name) do update set updated_at = now()
  returning id into c2;

  -- ---- Contact ----
  insert into contacts (workspace_id, company_id, first_name, last_name, title, email, phone, source)
  values (ws, c1, 'Maria', 'Lopez', 'Senior Estimator', 'maria@lonestargc.com', '512-555-0101', 'manual')
  on conflict (workspace_id, email) do update set updated_at = now()
  returning id into ct1;

  -- ---- Bids ----
  insert into bids (id, workspace_id, project_name, address, city, state,
                    gc_name, gc_email, company_id, contact_id,
                    bid_due_date, scope, trades, status, our_bid_amount)
  values
    ('BID-2026-001', ws, 'Riverside Office Renovation', '100 River Rd', 'Austin', 'TX',
     'Lone Star General Contractors', 'bids@lonestargc.com', c1, ct1,
     current_date + 14, 'Electrical rough-in and fixtures', array['Electrical'], 'Active', 84500.00),
    ('BID-2026-002', ws, 'Cedar Park Retail Buildout', '22 Market St', 'Cedar Park', 'TX',
     'Lone Star General Contractors', 'bids@lonestargc.com', c1, ct1,
     current_date + 7, 'Full electrical package', array['Electrical'], 'Reviewing', null)
  on conflict (id) do update set updated_at = now();

  -- ---- Estimate on the first bid ----
  insert into estimates (workspace_id, bid_id, name, status, total_amount, markup_pct, line_items)
  values (ws, 'BID-2026-001', 'Riverside Estimate v1', 'Draft', 84500.00, 12.0,
    '[{"description":"Service panel upgrade","qty":1,"unit_cost":6500},
      {"description":"Recessed LED fixtures","qty":40,"unit_cost":120},
      {"description":"Branch circuit wiring (labor)","qty":1,"unit_cost":18000}]'::jsonb)
  on conflict do nothing;

  -- ---- Attach the most recently signed-up user as workspace OWNER ----
  -- (RLS shows data only to members. If this prints a notice, sign up
  --  in the app first, then re-run this file.)
  select id into uid from profiles order by created_at desc limit 1;
  if uid is not null then
    insert into workspace_members (workspace_id, user_id, role)
    values (ws, uid, 'owner')
    on conflict (workspace_id, user_id) do update set role = 'owner';
    raise notice 'Attached user % to demo workspace as owner.', uid;
  else
    raise notice 'No user found yet — sign up in the app, then re-run this file.';
  end if;
end $$;

-- Quick check (should return 2 bids):
-- select id, project_name, status, our_bid_amount from bids order by id;
