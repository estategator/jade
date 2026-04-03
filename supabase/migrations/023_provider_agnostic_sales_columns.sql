-- Migration 023: Add provider-agnostic sales columns
-- Step 1 of 2: Add new columns and backfill. Old columns are kept until code is deployed.

-- Add new provider-agnostic columns to sales
ALTER TABLE sales ADD COLUMN IF NOT EXISTS payment_provider text;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS provider_session_id text;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS provider_payment_id text;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS provider_account_id text;

-- Backfill Stripe sales (no prefix)
UPDATE sales
SET payment_provider = 'stripe',
    provider_session_id = stripe_checkout_session_id,
    provider_payment_id = stripe_payment_intent_id,
    provider_account_id = stripe_connected_account_id
WHERE stripe_payment_intent_id IS NOT NULL
  AND stripe_payment_intent_id NOT LIKE 'sq_%'
  AND stripe_payment_intent_id NOT LIKE 'clover_%'
  AND payment_provider IS NULL;

-- Backfill Square sales (strip sq_ prefix)
UPDATE sales
SET payment_provider = 'square',
    provider_session_id = CASE
      WHEN stripe_checkout_session_id LIKE 'sq_%'
      THEN substring(stripe_checkout_session_id FROM 4)
      ELSE stripe_checkout_session_id
    END,
    provider_payment_id = CASE
      WHEN stripe_payment_intent_id LIKE 'sq_%'
      THEN substring(stripe_payment_intent_id FROM 4)
      ELSE stripe_payment_intent_id
    END,
    provider_account_id = CASE
      WHEN stripe_connected_account_id LIKE 'sq_%'
      THEN substring(stripe_connected_account_id FROM 4)
      ELSE stripe_connected_account_id
    END
WHERE stripe_payment_intent_id LIKE 'sq_%'
  AND payment_provider IS NULL;

-- Backfill Clover sales (strip clover_ prefix)
UPDATE sales
SET payment_provider = 'clover',
    provider_session_id = CASE
      WHEN stripe_checkout_session_id LIKE 'clover_%'
      THEN substring(stripe_checkout_session_id FROM 8)
      ELSE stripe_checkout_session_id
    END,
    provider_payment_id = CASE
      WHEN stripe_payment_intent_id LIKE 'clover_%'
      THEN substring(stripe_payment_intent_id FROM 8)
      ELSE stripe_payment_intent_id
    END,
    provider_account_id = CASE
      WHEN stripe_connected_account_id LIKE 'clover_%'
      THEN substring(stripe_connected_account_id FROM 8)
      ELSE stripe_connected_account_id
    END
WHERE stripe_payment_intent_id LIKE 'clover_%'
  AND payment_provider IS NULL;

-- Add index for provider-based lookups
CREATE INDEX IF NOT EXISTS idx_sales_provider_payment
  ON sales (payment_provider, provider_payment_id);

-- Also backfill checkout_sessions if they have the sq_/clover_ prefix pattern
ALTER TABLE checkout_sessions ADD COLUMN IF NOT EXISTS payment_provider text;
ALTER TABLE checkout_sessions ADD COLUMN IF NOT EXISTS provider_session_id text;

UPDATE checkout_sessions
SET payment_provider = 'stripe',
    provider_session_id = stripe_checkout_session_id
WHERE stripe_checkout_session_id IS NOT NULL
  AND stripe_checkout_session_id NOT LIKE 'sq_%'
  AND stripe_checkout_session_id NOT LIKE 'clover_%'
  AND payment_provider IS NULL;

UPDATE checkout_sessions
SET payment_provider = 'square',
    provider_session_id = CASE
      WHEN stripe_checkout_session_id LIKE 'sq_%'
      THEN substring(stripe_checkout_session_id FROM 4)
      ELSE stripe_checkout_session_id
    END
WHERE stripe_checkout_session_id LIKE 'sq_%'
  AND payment_provider IS NULL;

UPDATE checkout_sessions
SET payment_provider = 'clover',
    provider_session_id = CASE
      WHEN stripe_checkout_session_id LIKE 'clover_%'
      THEN substring(stripe_checkout_session_id FROM 8)
      ELSE stripe_checkout_session_id
    END
WHERE stripe_checkout_session_id LIKE 'clover_%'
  AND payment_provider IS NULL;
