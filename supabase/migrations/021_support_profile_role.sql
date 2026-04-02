-- Add 'support' to the profiles.role check constraint
-- and update ticket/reply RLS policies to grant support users
-- the same portal access currently held by developers.

-- 1. Expand profiles role constraint
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('user', 'admin', 'superadmin', 'developer', 'support'));

-- 2. Update support_tickets RLS policies
DROP POLICY IF EXISTS "Developers can view all tickets" ON support_tickets;
CREATE POLICY "Staff can view all tickets"
  ON support_tickets FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('developer', 'support')
    )
  );

DROP POLICY IF EXISTS "Developers can update all tickets" ON support_tickets;
CREATE POLICY "Staff can update all tickets"
  ON support_tickets FOR UPDATE
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

-- 3. Update ticket_replies RLS policies
DROP POLICY IF EXISTS "Developers can view all replies" ON ticket_replies;
CREATE POLICY "Staff can view all replies"
  ON ticket_replies FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('developer', 'support')
    )
  );

DROP POLICY IF EXISTS "Developers can create admin replies" ON ticket_replies;
CREATE POLICY "Staff can create admin replies"
  ON ticket_replies FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND is_admin = true
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('developer', 'support')
    )
  );
