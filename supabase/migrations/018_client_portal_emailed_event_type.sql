-- Add 'client_portal_emailed' to the project_transparency_events event_type check constraint.

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
      'walkthrough_completed',
      'client_portal_emailed'
    )
  );
