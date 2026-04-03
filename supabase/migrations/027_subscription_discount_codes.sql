-- =========================
-- 027: Subscription discount codes (support-issued, user-targeted)
--
-- Allows staff (developer / support) to create per-user discount codes
-- for subscription billing. Max 50% off, max 3 months duration.
-- Supports both self-serve redemption and staff direct-apply flows.
-- =========================

-- ── 1. Discount codes table ─────────────────────────────────

CREATE TABLE IF NOT EXISTS subscription_discount_codes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code             text NOT NULL UNIQUE,
  target_user_id   uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  issuer_user_id   uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  percent_off      integer NOT NULL
                     CHECK (percent_off >= 1 AND percent_off <= 50),
  duration_months  integer NOT NULL
                     CHECK (duration_months >= 1 AND duration_months <= 3),
  status           text NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active', 'expired', 'revoked', 'redeemed')),
  max_redemptions  integer NOT NULL DEFAULT 1
                     CHECK (max_redemptions >= 1),
  times_redeemed   integer NOT NULL DEFAULT 0,
  note             text,
  expires_at       timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_discount_codes_code
  ON subscription_discount_codes (code);

CREATE INDEX IF NOT EXISTS idx_discount_codes_target_user
  ON subscription_discount_codes (target_user_id, status);

CREATE INDEX IF NOT EXISTS idx_discount_codes_issuer
  ON subscription_discount_codes (issuer_user_id, created_at DESC);

-- ── 2. Discount redemptions table ───────────────────────────

CREATE TABLE IF NOT EXISTS subscription_discount_redemptions (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discount_code_id          uuid NOT NULL REFERENCES subscription_discount_codes (id) ON DELETE CASCADE,
  org_id                    uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  redeemed_by_user_id       uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  applied_via               text NOT NULL
                              CHECK (applied_via IN ('self_serve', 'support')),
  stripe_coupon_id          text,
  stripe_subscription_id    text,
  created_at                timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_discount_redemptions_code
  ON subscription_discount_redemptions (discount_code_id);

CREATE INDEX IF NOT EXISTS idx_discount_redemptions_org
  ON subscription_discount_redemptions (org_id, created_at DESC);

-- ── 3. RLS ──────────────────────────────────────────────────

ALTER TABLE subscription_discount_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_discount_redemptions ENABLE ROW LEVEL SECURITY;

-- Staff can do everything with discount codes
CREATE POLICY "Staff can manage discount codes"
  ON subscription_discount_codes FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('developer', 'support')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('developer', 'support')
    )
  );

-- Target user can view their own active codes (for self-serve redemption)
CREATE POLICY "Target user can view own active codes"
  ON subscription_discount_codes FOR SELECT
  TO authenticated
  USING (
    target_user_id = auth.uid()
    AND status = 'active'
  );

-- Staff can manage all redemption records
CREATE POLICY "Staff can manage redemptions"
  ON subscription_discount_redemptions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('developer', 'support')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('developer', 'support')
    )
  );

-- Users can view redemptions on their own orgs
CREATE POLICY "Org members can view redemptions"
  ON subscription_discount_redemptions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM org_members
      WHERE org_members.org_id = subscription_discount_redemptions.org_id
        AND org_members.user_id = auth.uid()
    )
  );
