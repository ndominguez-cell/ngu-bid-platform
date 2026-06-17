-- ============================================================
-- BOUTIQUE DEMO SEED (run AFTER 01 + 03, and after you sign up)
-- Paste into: Supabase Dashboard > SQL Editor > New Query > Run.
--
-- Order:
--   1. 01_full_setup.sql      (chassis + construction reference)
--   2. 03_boutique_vertical.sql (boutique tables)
--   3. sign up in the app
--   4. THIS file
--
-- Creates a "Boutique (Demo)" workspace with a supplier, a couple of
-- products + variants/stock, a customer, one sale, a San Antonio pop-up
-- event, and a social post promoting it — then attaches your account so
-- you can see it. Safe to re-run.
-- ============================================================

do $$
declare
  ws    uuid;
  sup   uuid;
  p1    uuid;
  p2    uuid;
  v1    uuid;   -- dress, M
  v2    uuid;   -- dress, L
  v3    uuid;   -- earrings, OS
  cust  uuid;
  evt   uuid;
  sale  uuid;
  uid   uuid;
begin
  -- ---- Workspace ----
  select id into ws from workspaces where name = 'Boutique (Demo)' limit 1;
  if ws is null then
    insert into workspaces (name) values ('Boutique (Demo)') returning id into ws;
  end if;

  -- ---- Supplier ----
  insert into boutique_suppliers (workspace_id, name, contact_name, email, city, state, lead_time_days)
  values (ws, 'Alamo Wholesale Apparel', 'Dana Reyes', 'sales@alamowholesale.com', 'San Antonio', 'TX', 10)
  returning id into sup;

  -- ---- Products ----
  insert into boutique_products (workspace_id, name, description, category, brand, supplier_id, base_sku, retail_price, cost, status, tags)
  values (ws, 'Wildflower Wrap Dress', 'Lightweight floral wrap dress', 'Dresses', 'Hill Country Co.', sup, 'WFWD', 68.00, 27.00, 'active', array['summer','bestseller'])
  returning id into p1;

  insert into boutique_products (workspace_id, name, description, category, brand, base_sku, retail_price, cost, status, tags)
  values (ws, 'Brass Sunburst Earrings', 'Handmade brass statement earrings', 'Accessories', 'Local Maker', 'BSE', 24.00, 8.50, 'active', array['handmade','local'])
  returning id into p2;

  -- ---- Variants (with stock) ----
  insert into boutique_variants (workspace_id, product_id, sku, size, color, retail_price, cost, stock_qty, reorder_point)
  values (ws, p1, 'WFWD-M-BLU', 'M', 'Bluebonnet', 68.00, 27.00, 6, 3) returning id into v1;
  insert into boutique_variants (workspace_id, product_id, sku, size, color, retail_price, cost, stock_qty, reorder_point)
  values (ws, p1, 'WFWD-L-BLU', 'L', 'Bluebonnet', 68.00, 27.00, 2, 3) returning id into v2;   -- below reorder point
  insert into boutique_variants (workspace_id, product_id, sku, size, color, retail_price, cost, stock_qty, reorder_point)
  values (ws, p2, 'BSE-OS-BRS', 'OS', 'Brass', 24.00, 8.50, 15, 5) returning id into v3;

  -- ---- Customer ----
  insert into boutique_customers (workspace_id, first_name, last_name, email, instagram_handle, marketing_opt_in, tags)
  values (ws, 'Sofia', 'Martinez', 'sofia.m@example.com', '@sofiastyle', true, array['vip','repeat'])
  returning id into cust;

  -- ---- Pop-up event (San Antonio) ----
  insert into boutique_events (workspace_id, name, venue, address, city, state, starts_at, ends_at, status, booth_cost, expected_traffic, notes)
  values (ws, 'Pearl Farmers Market Pop-Up', 'Pearl District', '303 Pearl Pkwy', 'San Antonio', 'TX',
          now() + interval '10 days', now() + interval '10 days 5 hours', 'confirmed', 75.00, 800,
          'Weekend booth; bring summer dresses + accessories')
  returning id into evt;

  -- ---- A sale (online, to the customer above) ----
  insert into boutique_sales (workspace_id, order_number, channel, customer_id, status, subtotal, discount, tax, total, payment_method, sold_at)
  values (ws, 'SO-1001', 'online', cust, 'paid', 92.00, 0, 7.59, 99.59, 'card', now() - interval '2 days')
  returning id into sale;

  insert into boutique_sale_items (workspace_id, sale_id, variant_id, product_name, sku, qty, unit_price, line_total)
  values
    (ws, sale, v1, 'Wildflower Wrap Dress', 'WFWD-M-BLU', 1, 68.00, 68.00),
    (ws, sale, v3, 'Brass Sunburst Earrings', 'BSE-OS-BRS', 1, 24.00, 24.00);

  update boutique_customers
     set total_spent = 99.59, last_purchase_at = now() - interval '2 days'
   where id = cust;

  -- ---- Social post promoting the pop-up ----
  insert into boutique_marketing_posts (workspace_id, platform, title, content, status, scheduled_for, event_id)
  values (ws, 'instagram', 'Pearl Pop-Up this weekend!',
          'Find us at the Pearl Farmers Market this Saturday — new summer dresses + handmade earrings. ☀️ #shopsmall #satx',
          'scheduled', now() + interval '8 days', evt);

  -- ---- Attach your account so RLS lets you see all this ----
  select id into uid from profiles order by created_at desc limit 1;
  if uid is not null then
    insert into workspace_members (workspace_id, user_id, role)
    values (ws, uid, 'owner')
    on conflict (workspace_id, user_id) do update set role = 'owner';
    raise notice 'Attached user % to Boutique (Demo) as owner.', uid;
  else
    raise notice 'No user found — sign up in the app, then re-run this file.';
  end if;
end $$;

-- Quick checks:
-- select name, status from boutique_products;
-- select sku, size, stock_qty, reorder_point,
--        (stock_qty <= reorder_point) as needs_reorder from boutique_variants order by sku;
-- select name, city, starts_at, status from boutique_events;
