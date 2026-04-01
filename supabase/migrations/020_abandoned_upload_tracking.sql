-- Add abandoned_at tracking column for cleanup of unfinished uploads.
-- Items prepared (DB row inserted) but never finalized (user closed tab)
-- can be detected by the cleanup-abandoned cron job.

alter table inventory_items
  add column if not exists abandoned_at timestamptz;

-- Partial index for the cleanup query: unfinished items without a source image.
-- Covers: processing_status IN ('queued','processing','failed')
--         AND original_image_url IS NULL
create index if not exists idx_inventory_items_abandoned_candidates
  on inventory_items (created_at)
  where processing_status in ('queued', 'processing', 'failed')
    and original_image_url is null;
