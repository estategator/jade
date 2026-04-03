-- Migration 024: Drop legacy Stripe-only columns
-- Step 2 of 2: Remove old columns AFTER application code is deployed and verified.
-- Run this ONLY after confirming no code references the old column names.

-- Drop legacy columns from sales
ALTER TABLE sales DROP COLUMN IF EXISTS stripe_checkout_session_id;
ALTER TABLE sales DROP COLUMN IF EXISTS stripe_payment_intent_id;
ALTER TABLE sales DROP COLUMN IF EXISTS stripe_connected_account_id;

-- Drop legacy columns from checkout_sessions
ALTER TABLE checkout_sessions DROP COLUMN IF EXISTS stripe_checkout_session_id;

-- Drop legacy columns from organizations
ALTER TABLE organizations DROP COLUMN IF EXISTS stripe_account_id;
ALTER TABLE organizations DROP COLUMN IF EXISTS stripe_onboarding_complete;
