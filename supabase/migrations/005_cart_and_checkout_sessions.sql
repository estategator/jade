-- ============================================================
-- Migration 005: Cart system & multi-item checkout sessions
-- Adds cart_items for user shopping carts and checkout_sessions
-- + checkout_session_items for persisted reservation tracking.
-- ============================================================

-- =========================
-- 1. Cart items (per-user, per-org shopping cart)
-- =========================
create table if not exists cart_items (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  org_id            uuid not null references organizations (id) on delete cascade,
  inventory_item_id uuid not null references inventory_items (id) on delete cascade,
  quantity          integer not null default 1 check (quantity >= 1),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  -- One cart entry per user/org/item combo
  unique (user_id, org_id, inventory_item_id)
);

create index if not exists idx_cart_items_user_org
  on cart_items (user_id, org_id);

-- ---- cart_items RLS ----
alter table cart_items enable row level security;

create policy "Users can view own cart items"
  on cart_items for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own cart items"
  on cart_items for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own cart items"
  on cart_items for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own cart items"
  on cart_items for delete
  to authenticated
  using (auth.uid() = user_id);

-- =========================
-- 2. Checkout sessions (links internal cart snapshot to Stripe)
-- =========================
create table if not exists checkout_sessions (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references auth.users (id) on delete cascade,
  org_id                   uuid not null references organizations (id) on delete cascade,
  stripe_checkout_session_id text,
  stripe_connected_account_id text,
  status                   text not null default 'pending'
                             check (status in ('pending', 'completed', 'expired', 'cancelled')),
  total_amount             numeric(12,2) not null default 0,
  currency                 text not null default 'usd',
  expires_at               timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index if not exists idx_checkout_sessions_user
  on checkout_sessions (user_id);

create index if not exists idx_checkout_sessions_stripe
  on checkout_sessions (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

-- ---- checkout_sessions RLS ----
alter table checkout_sessions enable row level security;

create policy "Users can view own checkout sessions"
  on checkout_sessions for select
  to authenticated
  using (auth.uid() = user_id);

-- =========================
-- 3. Checkout session items (line-level reservation records)
-- =========================
create table if not exists checkout_session_items (
  id                    uuid primary key default gen_random_uuid(),
  checkout_session_id   uuid not null references checkout_sessions (id) on delete cascade,
  inventory_item_id     uuid not null references inventory_items (id) on delete cascade,
  quantity              integer not null default 1 check (quantity >= 1),
  unit_price            numeric(12,2) not null,
  reserved_quantity     integer not null default 0,
  created_at            timestamptz not null default now()
);

create index if not exists idx_checkout_session_items_session
  on checkout_session_items (checkout_session_id);

create index if not exists idx_checkout_session_items_item
  on checkout_session_items (inventory_item_id);

-- ---- checkout_session_items RLS ----
alter table checkout_session_items enable row level security;

create policy "Users can view own checkout session items"
  on checkout_session_items for select
  to authenticated
  using (
    exists (
      select 1 from checkout_sessions
      where checkout_sessions.id = checkout_session_items.checkout_session_id
        and checkout_sessions.user_id = auth.uid()
    )
  );
