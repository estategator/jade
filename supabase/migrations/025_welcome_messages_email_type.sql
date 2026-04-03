-- Migration: Add first-class email_type column to welcome_messages
-- Decouples welcome, client-portal, and contract-sent emails so each
-- flow has explicit lifecycle tracking instead of metadata-only markers.

-- 1. Add email_type column with backward-compatible default
alter table welcome_messages
  add column if not exists email_type text not null default 'welcome'
    check (email_type in ('welcome', 'client_portal', 'contract_sent'));

-- 2. Backfill from metadata for existing rows
update welcome_messages
  set email_type = (metadata->>'email_type')
  where metadata->>'email_type' is not null
    and metadata->>'email_type' in ('client_portal', 'contract_sent');

-- 3. Drop old assignment-only uniqueness index (one active per assignment)
drop index if exists idx_welcome_messages_active_assignment;

-- 4. Create type-aware uniqueness (one active draft/queued per assignment per type)
create unique index if not exists idx_welcome_messages_active_assignment_type
  on welcome_messages (assignment_id, email_type)
  where status in ('draft', 'queued');

-- 5. Add helpful lookup index by email_type
create index if not exists idx_welcome_messages_email_type
  on welcome_messages (email_type, status, created_at desc);
