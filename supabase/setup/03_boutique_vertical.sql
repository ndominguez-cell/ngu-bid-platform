-- ============================================================
-- BOUTIQUE VERTICAL — domain tables for a retail boutique
-- Paste into: Supabase Dashboard > SQL Editor > New Query > Run.
--
-- PREREQUISITE: run 01_full_setup.sql first. This file reuses the
-- chassis it created: the workspaces table, the is_workspace_member()
-- helper, and the update_updated_at() trigger function.
--
-- This adds a brand-new business domain alongside (not replacing) the
-- construction tables: products, inventory, suppliers, purchasing,
-- customers, sales, pop-up EVENTS, and a social MARKETING calendar.
-- Every table is workspace-scoped, so a boutique's data is walled off
-- from NGU's exactly the same way.
--
-- Safe to re-run: idempotent.
-- ============================================================

-- ============================================================
-- SUPPLIERS / VENDORS
-- ============================================================
create table if not exists boutique_suppliers (
  id             uuid primary key default uuid_generate_v4(),
  workspace_id   uuid not null references workspaces(id) on delete cascade,
  name           text not null,
  contact_name   text,
  email          text,
  phone          text,
  website        text,
  address        text,
  city           text,
  state          text default 'TX',
  lead_time_days int,
  notes          text,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

-- ============================================================
-- PRODUCTS  (the catalog item; variants hold size/color + stock)
-- ============================================================
create table if not exists boutique_products (
  id            uuid primary key default uuid_generate_v4(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  name          text not null,
  description   text,
  category      text,
  brand         text,
  supplier_id   uuid references boutique_suppliers(id) on delete set null,
  base_sku      text,
  retail_price  numeric(10,2),         -- default price; variants may override
  cost          numeric(10,2),         -- default cost; variants may override
  status        text check (status in ('active','draft','archived')) default 'active',
  image_path    text,                  -- key in the 'documents' storage bucket
  tags          text[],
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ============================================================
-- PRODUCT VARIANTS  (one row per size/color combo — holds stock)
-- Unified stock for BOTH in-store and online sales.
-- ============================================================
create table if not exists boutique_variants (
  id            uuid primary key default uuid_generate_v4(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  product_id    uuid not null references boutique_products(id) on delete cascade,
  sku           text,
  size          text,
  color         text,
  barcode       text,
  retail_price  numeric(10,2),
  cost          numeric(10,2),
  stock_qty     int default 0,
  reorder_point int default 0,         -- alert when stock_qty <= this
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ============================================================
-- CUSTOMERS / CRM
-- ============================================================
create table if not exists boutique_customers (
  id                uuid primary key default uuid_generate_v4(),
  workspace_id      uuid not null references workspaces(id) on delete cascade,
  first_name        text not null,
  last_name         text,
  email             text,
  phone             text,
  instagram_handle  text,
  marketing_opt_in  boolean default false,
  tags              text[],
  total_spent       numeric(12,2) default 0,
  last_purchase_at  timestamptz,
  notes             text,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

-- ============================================================
-- POP-UP EVENTS  (scheduling sales events across San Antonio)
-- ============================================================
create table if not exists boutique_events (
  id              uuid primary key default uuid_generate_v4(),
  workspace_id    uuid not null references workspaces(id) on delete cascade,
  name            text not null,
  venue           text,
  address         text,
  city            text default 'San Antonio',
  state           text default 'TX',
  starts_at       timestamptz,
  ends_at         timestamptz,
  status          text check (status in ('idea','planned','confirmed','done','cancelled')) default 'idea',
  booth_cost      numeric(10,2),
  expected_traffic int,
  notes           text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ============================================================
-- SALES / ORDERS  (in-store, online, or at a pop-up)
-- ============================================================
create table if not exists boutique_sales (
  id             uuid primary key default uuid_generate_v4(),
  workspace_id   uuid not null references workspaces(id) on delete cascade,
  order_number   text,
  channel        text check (channel in ('in_store','online','popup')) default 'in_store',
  customer_id    uuid references boutique_customers(id) on delete set null,
  event_id       uuid references boutique_events(id) on delete set null,  -- set when sold at a pop-up
  status         text check (status in ('pending','paid','refunded','cancelled')) default 'paid',
  subtotal       numeric(12,2) default 0,
  discount       numeric(12,2) default 0,
  tax            numeric(12,2) default 0,
  total          numeric(12,2) default 0,
  payment_method text,
  sold_at        timestamptz default now(),
  notes          text,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

-- ============================================================
-- SALE LINE ITEMS
-- ============================================================
create table if not exists boutique_sale_items (
  id            uuid primary key default uuid_generate_v4(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  sale_id       uuid not null references boutique_sales(id) on delete cascade,
  variant_id    uuid references boutique_variants(id) on delete set null,
  product_name  text,                  -- snapshot in case product is later edited/deleted
  sku           text,
  qty           int not null default 1,
  unit_price    numeric(10,2) not null default 0,
  line_total    numeric(12,2) not null default 0,
  created_at    timestamptz default now()
);

-- ============================================================
-- PURCHASE ORDERS  (buying stock from suppliers)
-- ============================================================
create table if not exists boutique_purchase_orders (
  id             uuid primary key default uuid_generate_v4(),
  workspace_id   uuid not null references workspaces(id) on delete cascade,
  po_number      text,
  supplier_id    uuid references boutique_suppliers(id) on delete set null,
  status         text check (status in ('draft','ordered','partial','received','cancelled')) default 'draft',
  order_date     date,
  expected_date  date,
  received_date  date,
  total          numeric(12,2) default 0,
  notes          text,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

create table if not exists boutique_po_items (
  id            uuid primary key default uuid_generate_v4(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  po_id         uuid not null references boutique_purchase_orders(id) on delete cascade,
  variant_id    uuid references boutique_variants(id) on delete set null,
  description   text,
  qty_ordered   int not null default 0,
  qty_received  int default 0,
  unit_cost     numeric(10,2) default 0,
  line_total    numeric(12,2) default 0,
  created_at    timestamptz default now()
);

-- ============================================================
-- MARKETING / SOCIAL CALENDAR
-- ============================================================
create table if not exists boutique_marketing_posts (
  id             uuid primary key default uuid_generate_v4(),
  workspace_id   uuid not null references workspaces(id) on delete cascade,
  platform       text check (platform in ('instagram','facebook','tiktok','email','other')) default 'instagram',
  title          text,
  content        text,
  status         text check (status in ('idea','draft','scheduled','posted')) default 'idea',
  scheduled_for  timestamptz,
  posted_at      timestamptz,
  event_id       uuid references boutique_events(id) on delete set null,  -- promote a pop-up
  link           text,
  image_path     text,
  metrics        jsonb default '{}',    -- likes/reach/clicks etc.
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

-- ============================================================
-- INDEXES (every query is scoped by workspace_id)
-- ============================================================
create index if not exists boutique_suppliers_ws_idx       on boutique_suppliers(workspace_id);
create index if not exists boutique_products_ws_idx        on boutique_products(workspace_id);
create index if not exists boutique_variants_ws_idx        on boutique_variants(workspace_id);
create index if not exists boutique_variants_product_idx   on boutique_variants(product_id);
create index if not exists boutique_customers_ws_idx       on boutique_customers(workspace_id);
create index if not exists boutique_events_ws_idx          on boutique_events(workspace_id);
create index if not exists boutique_sales_ws_idx           on boutique_sales(workspace_id);
create index if not exists boutique_sale_items_ws_idx      on boutique_sale_items(workspace_id);
create index if not exists boutique_sale_items_sale_idx    on boutique_sale_items(sale_id);
create index if not exists boutique_po_ws_idx              on boutique_purchase_orders(workspace_id);
create index if not exists boutique_po_items_ws_idx        on boutique_po_items(workspace_id);
create index if not exists boutique_marketing_ws_idx       on boutique_marketing_posts(workspace_id);

-- ============================================================
-- UPDATED_AT TRIGGERS (reuses update_updated_at() from 01_full_setup)
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array[
    'boutique_suppliers','boutique_products','boutique_variants',
    'boutique_customers','boutique_events','boutique_sales',
    'boutique_purchase_orders','boutique_marketing_posts'
  ]
  loop
    execute format('drop trigger if exists %I_updated_at on %I', t, t);
    execute format('create trigger %I_updated_at before update on %I
      for each row execute procedure update_updated_at()', t, t);
  end loop;
end $$;

-- ============================================================
-- ROW LEVEL SECURITY — members of the row's workspace get full access
-- (reuses is_workspace_member() from 01_full_setup)
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array[
    'boutique_suppliers','boutique_products','boutique_variants',
    'boutique_customers','boutique_events','boutique_sales',
    'boutique_sale_items','boutique_purchase_orders','boutique_po_items',
    'boutique_marketing_posts'
  ]
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "workspace_member_all" on %I', t);
    execute format(
      'create policy "workspace_member_all" on %I for all to authenticated
         using (is_workspace_member(workspace_id))
         with check (is_workspace_member(workspace_id))', t);
  end loop;
end $$;

-- Done. Boutique domain is ready on the shared multi-tenant chassis.
