-- =========================
-- Onboarding Phase 2: schema hardening
-- =========================

-- Unique compound index on contracts for webhook idempotency.
-- Only enforced when an external_contract_id is present (i.e. provider != 'manual').
create unique index if not exists idx_contracts_provider_external_id
  on contracts (provider, external_contract_id)
  where external_contract_id is not null;

-- Unique compound index on walkthrough_sessions for scheduling idempotency.
create unique index if not exists idx_walkthrough_sessions_provider_external_id
  on walkthrough_sessions (provider, external_event_id)
  where external_event_id is not null;

-- Fast lookup of contract events by external event type + contract for replay detection.
create index if not exists idx_contract_events_type_contract
  on contract_events (contract_id, event_type, created_at desc);

-- Fast lookup of walkthrough events by external event type + session for replay detection.
create index if not exists idx_walkthrough_events_type_walkthrough
  on walkthrough_events (walkthrough_id, event_type, created_at desc);

-- Welcome messages: one active/queued message per assignment at a time.
create unique index if not exists idx_welcome_messages_active_assignment
  on welcome_messages (assignment_id)
  where status in ('draft', 'queued');

-- Expand event_type check constraint on project_transparency_events to support
-- contract, welcome email, and walkthrough events.
alter table project_transparency_events
  drop constraint if exists project_transparency_events_event_type_check;

alter table project_transparency_events
  add constraint project_transparency_events_event_type_check
  check (
    event_type in (
      'client_assigned',
      'share_link_created',
      'project_published',
      'inventory_created',
      'inventory_updated',
      'pricing_updated',
      'milestone_updated',
      'contract_sent',
      'contract_signed',
      'welcome_email_sent',
      'walkthrough_scheduled',
      'walkthrough_completed'
    )
  );
