-- =========================
-- Multi-Platform Listing Providers + External Orders
-- =========================
-- Extends listing_provider_connections to support Whatnot, Etsy,
-- Heritage Auctions, and eBay. Adds tables for tracking published
-- listings and inbound orders from external platforms.

-- ── 1. Extend listing_provider_connections ───────────────────

-- Allow new providers in the check constraint
alter table listing_provider_connections
  drop constraint if exists listing_provider_connections_provider_check;

alter table listing_provider_connections
  add constraint listing_provider_connections_provider_check
  check (provider in ('estatesales_net', 'whatnot', 'etsy', 'heritage_auctions', 'ebay'));

-- Add new columns for OAuth and sync tracking
alter table listing_provider_connections
  add column if not exists auth_type text not null default 'api_key'
    check (auth_type in ('oauth', 'api_key')),
  add column if not exists access_token_enc text,
  add column if not exists refresh_token_enc text,
  add column if not exists token_expires_at timestamptz,
  add column if not exists external_user_id text,
  add column if not exists sync_status text not null default 'idle'
    check (sync_status in ('idle', 'syncing', 'synced', 'error')),
  add column if not exists last_sync_at timestamptz,
  add column if not exists last_error jsonb;

-- Index for sync polling: find all connections needing sync
create index if not exists idx_lpc_sync_status
  on listing_provider_connections (sync_status, last_sync_at)
  where status = 'connected';

-- ── 2. Platform listings (outbound — what we published) ─────

create table if not exists platform_listings (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references organizations (id) on delete cascade,
  inventory_item_id   uuid not null references inventory_items (id) on delete cascade,
  provider            text not null
    check (provider in ('estatesales_net', 'whatnot', 'etsy', 'heritage_auctions', 'ebay')),
  external_listing_id text not null,
  external_data       jsonb not null default '{}'::jsonb,
  status              text not null default 'active'
    check (status in ('active', 'archived', 'sold', 'error')),
  published_at        timestamptz not null default now(),
  last_synced_at      timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  -- One listing per item per platform
  unique (org_id, inventory_item_id, provider)
);

-- Fast lookup by org + provider
create index if not exists idx_pl_org_provider
  on platform_listings (org_id, provider);

-- Fast lookup by inventory item (show all platforms an item is on)
create index if not exists idx_pl_inventory_item
  on platform_listings (inventory_item_id);

-- Fast lookup by external listing ID for webhook processing
create index if not exists idx_pl_external_listing
  on platform_listings (provider, external_listing_id)
  where status != 'archived';

-- RLS
alter table platform_listings enable row level security;

create policy "Org members can view platform listings"
  on platform_listings for select
  to authenticated
  using (
    exists (
      select 1 from org_members
      where org_members.org_id = platform_listings.org_id
        and org_members.user_id = auth.uid()
    )
  );

-- ── 3. External orders (inbound — orders from platforms) ────

create table if not exists external_orders (
  id                      uuid primary key default gen_random_uuid(),
  org_id                  uuid not null references organizations (id) on delete cascade,
  provider                text not null
    check (provider in ('whatnot', 'etsy', 'heritage_auctions', 'ebay')),
  external_order_id       text not null,
  external_item_id        text,
  inventory_item_id       uuid references inventory_items (id) on delete set null,
  status                  text not null default 'received'
    check (status in ('received', 'fulfilled', 'cancelled', 'error')),
  quantity                integer not null default 1,
  listing_price           numeric(10, 2) not null default 0,
  buyer_info              jsonb not null default '{}'::jsonb,
  external_data           jsonb not null default '{}'::jsonb,
  synced_at               timestamptz not null default now(),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),

  -- Prevent duplicate order imports
  unique (org_id, provider, external_order_id)
);

-- Fast lookup by org + provider
create index if not exists idx_eo_org_provider
  on external_orders (org_id, provider);

-- Fast lookup by org + status for dashboard
create index if not exists idx_eo_org_status
  on external_orders (org_id, status);

-- Fast lookup by inventory item for linking
create index if not exists idx_eo_inventory_item
  on external_orders (inventory_item_id)
  where inventory_item_id is not null;

-- RLS
alter table external_orders enable row level security;

create policy "Org members can view external orders"
  on external_orders for select
  to authenticated
  using (
    exists (
      select 1 from org_members
      where org_members.org_id = external_orders.org_id
        and org_members.user_id = auth.uid()
    )
  );
