-- Add 'analyzing' to the processing_status CHECK constraint.
-- This supports the two-stage pipeline: image derivation → AI analysis.
ALTER TABLE inventory_items
  DROP CONSTRAINT IF EXISTS inventory_items_processing_status_check;

ALTER TABLE inventory_items
  ADD CONSTRAINT inventory_items_processing_status_check
  CHECK (processing_status IN ('none', 'queued', 'processing', 'analyzing', 'complete', 'failed'));
