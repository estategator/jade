-- =========================
-- 026: Enable RLS on organization_invitations & user_notifications
--
-- These tables were created without RLS enabled in production.
-- schema.sql already declares the correct policies; this migration
-- brings the live database in sync.
-- =========================

-- ── 1. organization_invitations ──────────────────────────────

ALTER TABLE organization_invitations ENABLE ROW LEVEL SECURITY;

-- Org members can view invitations in their org; invited users can see their own
DROP POLICY IF EXISTS "Members can view invitations" ON organization_invitations;
CREATE POLICY "Members can view invitations"
  ON organization_invitations FOR SELECT
  TO authenticated
  USING (
    organization_invitations.invited_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM org_members AS my
      WHERE my.org_id = organization_invitations.org_id
        AND my.user_id = auth.uid()
    )
  );

-- Superadmin / admin can create invitations
DROP POLICY IF EXISTS "Admins can create invitations" ON organization_invitations;
CREATE POLICY "Admins can create invitations"
  ON organization_invitations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM org_members AS my
      WHERE my.org_id = organization_invitations.org_id
        AND my.user_id = auth.uid()
        AND my.role IN ('superadmin', 'admin')
    )
  );

-- Superadmin / admin can delete invitations
DROP POLICY IF EXISTS "Admins can delete invitations" ON organization_invitations;
CREATE POLICY "Admins can delete invitations"
  ON organization_invitations FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM org_members AS my
      WHERE my.org_id = organization_invitations.org_id
        AND my.user_id = auth.uid()
        AND my.role IN ('superadmin', 'admin')
    )
  );

-- ── 2. user_notifications ────────────────────────────────────

ALTER TABLE user_notifications ENABLE ROW LEVEL SECURITY;

-- Users can view only their own notifications
DROP POLICY IF EXISTS "Users can view own notifications" ON user_notifications;
CREATE POLICY "Users can view own notifications"
  ON user_notifications FOR SELECT
  TO authenticated
  USING (recipient_user_id = auth.uid());

-- Users can update only their own notifications (mark read, resolve)
DROP POLICY IF EXISTS "Users can update own notifications" ON user_notifications;
CREATE POLICY "Users can update own notifications"
  ON user_notifications FOR UPDATE
  TO authenticated
  USING (recipient_user_id = auth.uid())
  WITH CHECK (recipient_user_id = auth.uid());
