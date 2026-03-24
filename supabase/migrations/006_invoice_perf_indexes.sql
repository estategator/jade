-- ============================================================
-- Migration 006: Invoice performance indexes
-- Adds a composite index for the common list query pattern:
--   WHERE org_id = ? AND status = ? ORDER BY created_at DESC
-- The existing idx_invoices_org_status only covers (org_id, status)
-- without ordering, forcing a sort step on every filtered list.
-- ============================================================

create index if not exists idx_invoices_org_status_created
  on invoices (org_id, status, created_at desc);
