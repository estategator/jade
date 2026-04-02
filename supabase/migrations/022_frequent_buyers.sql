-- =========================
-- 022: Frequent buyers feature
--
-- 1. Extend client_profiles with starred flag and client type
-- 2. Create frequent_buyer_suggestions table
-- 3. Extend user_notifications kind for new notification types
-- =========================

-- ── 1. Extend client_profiles ────────────────────────────────

ALTER TABLE client_profiles
  ADD COLUMN IF NOT EXISTS is_starred boolean NOT NULL DEFAULT false;

ALTER TABLE client_profiles
  ADD COLUMN IF NOT EXISTS client_type text NOT NULL DEFAULT 'owner';

ALTER TABLE client_profiles
  DROP CONSTRAINT IF EXISTS client_profiles_client_type_check;

ALTER TABLE client_profiles
  ADD CONSTRAINT client_profiles_client_type_check
  CHECK (client_type IN ('owner', 'buyer'));

-- Partial index for quick starred lookups per org
CREATE INDEX IF NOT EXISTS idx_client_profiles_starred
  ON client_profiles (org_id)
  WHERE is_starred = true;

-- ── 2. Frequent buyer suggestions ────────────────────────────

CREATE TABLE IF NOT EXISTS frequent_buyer_suggestions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  buyer_email       text NOT NULL,
  sale_count        integer NOT NULL DEFAULT 0,
  total_spent       numeric(12, 2) NOT NULL DEFAULT 0,
  last_purchase_at  timestamptz,
  status            text NOT NULL DEFAULT 'pending',
  client_profile_id uuid REFERENCES client_profiles (id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT frequent_buyer_suggestions_status_check
    CHECK (status IN ('pending', 'dismissed', 'accepted')),
  UNIQUE (org_id, buyer_email)
);

CREATE INDEX IF NOT EXISTS idx_frequent_buyer_suggestions_org_pending
  ON frequent_buyer_suggestions (org_id)
  WHERE status = 'pending';

-- ── 3. RLS for frequent_buyer_suggestions ────────────────────

ALTER TABLE frequent_buyer_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view their org suggestions"
  ON frequent_buyer_suggestions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM org_members
      WHERE org_members.org_id = frequent_buyer_suggestions.org_id
        AND org_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Org admins can update their org suggestions"
  ON frequent_buyer_suggestions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM org_members
      WHERE org_members.org_id = frequent_buyer_suggestions.org_id
        AND org_members.user_id = auth.uid()
        AND org_members.role IN ('admin', 'superadmin')
    )
  );
