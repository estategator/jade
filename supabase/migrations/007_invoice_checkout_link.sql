-- ============================================================
-- Migration 007: Link invoices to checkout sessions
-- Adds stripe_checkout_session_id column for auto-generated invoices
-- with a unique constraint for idempotency.
-- ============================================================

-- Stripe checkout session ID for auto-generated invoices (idempotency key)
alter table invoices
  add column if not exists stripe_checkout_session_id text;

-- Unique constraint ensures one invoice per checkout (idempotency)
create unique index if not exists idx_invoices_stripe_checkout_session
  on invoices (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

-- Source discriminator: 'manual' (user-generated) vs 'checkout' (auto-generated)
alter table invoices
  add column if not exists source text not null default 'manual'
    check (source in ('manual', 'checkout'));
