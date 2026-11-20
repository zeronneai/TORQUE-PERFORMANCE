-- ─────────────────────────────────────────────────────────────────────────────
-- TORQUE SHOP (merch). Coaches manage products in Admin > Shop; parents buy at
-- torquebaseball.us/shop. Two ways to pay: online card (GoDaddy Payments / Poynt
-- Collect) or order online and pay at pickup with the Smart Terminal.
-- Reads/writes go through the server (service role). The public website only
-- sees ACTIVE products and the shop settings.
-- Run once in the Supabase SQL editor. Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.shop_products (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  description  text,
  price_cents  int  not null check (price_cents >= 0),
  photos       text[] not null default '{}',       -- public URLs (shop-photos bucket)
  variants     jsonb  not null default '[]',       -- [{ "label": "YM", "stock": 5 }] ; stock null = unlimited
  track_stock  boolean not null default false,
  active       boolean not null default true,
  sort         int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- One row (id = 1) with the shop settings.
create table if not exists public.shop_settings (
  id                   int primary key default 1 check (id = 1),
  open                 boolean not null default true,
  pay_online           boolean not null default true,    -- card online (GoDaddy)
  pay_pickup           boolean not null default true,    -- order online, pay at the academy
  pickup_enabled       boolean not null default true,
  pickup_note          text default 'Pick up at the academy front desk, 2010 Bassett Ave, El Paso, TX.',
  shipping_enabled     boolean not null default false,
  shipping_cents       int not null default 0,
  tax_percent          numeric(5,3) not null default 0,  -- e.g. 8.25 ; 0 = prices already include tax
  notify_email         text,
  updated_at           timestamptz not null default now()
);
insert into public.shop_settings (id) values (1) on conflict (id) do nothing;

create sequence if not exists public.shop_order_number start 1001;
create table if not exists public.shop_orders (
  id                 uuid primary key default gen_random_uuid(),
  order_number       int not null default nextval('public.shop_order_number') unique,
  created_at         timestamptz not null default now(),
  customer_name      text not null,
  email              text not null,
  phone              text,
  items              jsonb not null,                    -- [{ product_id, name, variant, qty, unit_cents }]
  subtotal_cents     int not null,
  tax_cents          int not null default 0,
  shipping_cents     int not null default 0,
  total_cents        int not null,
  fulfillment        text not null default 'pickup',    -- pickup | ship
  ship_address       jsonb,
  payment_method     text not null,                     -- online | pickup
  payment_status     text not null default 'unpaid',    -- unpaid | paid | failed | refunded
  transaction_id     text,                              -- GoDaddy / Poynt transaction id
  status             text not null default 'new',       -- new | ready | picked_up | shipped | canceled
  notes              text,
  updated_at         timestamptz not null default now()
);
create index if not exists shop_orders_created_idx on public.shop_orders (created_at desc);

alter table public.shop_products enable row level security;
alter table public.shop_settings enable row level security;
alter table public.shop_orders   enable row level security;
-- No public policies: the website and the admin panel read through their servers.

-- Public bucket for product photos (anyone can view, only the server uploads).
insert into storage.buckets (id, name, public)
values ('shop-photos', 'shop-photos', true)
on conflict (id) do nothing;
