-- =========================
-- Client onboarding foundation
-- =========================

create table if not exists client_profiles (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations (id) on delete cascade,
  full_name   text not null,
  email       text not null,
  phone       text,
  notes       text not null default '',
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (org_id, email)
);

create index if not exists idx_client_profiles_org_created
  on client_profiles (org_id, created_at desc);

create table if not exists client_project_assignments (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references organizations (id) on delete cascade,
  client_profile_id  uuid not null references client_profiles (id) on delete cascade,
  project_id         uuid not null references projects (id) on delete cascade,
  status             text not null default 'active'
                       check (status in ('active', 'archived')),
  assigned_by        uuid references auth.users (id) on delete set null,
  assigned_at        timestamptz not null default now(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (client_profile_id, project_id)
);

create index if not exists idx_client_assignments_org_project
  on client_project_assignments (org_id, project_id, created_at desc);

create table if not exists onboarding_workflows (
  id                   uuid primary key default gen_random_uuid(),
  org_id               uuid not null references organizations (id) on delete cascade,
  assignment_id        uuid not null unique references client_project_assignments (id) on delete cascade,
  stage                text not null default 'invited'
                         check (
                           stage in (
                             'invited',
                             'contract_sent',
                             'contract_signed',
                             'welcome_sent',
                             'walkthrough_scheduled',
                             'project_shared',
                             'inventory_in_progress',
                             'pricing_in_progress',
                             'sale_ready'
                           )
                         ),
  progress_percent     integer not null default 0 check (progress_percent >= 0 and progress_percent <= 100),
  contract_status      text not null default 'not_started'
                         check (contract_status in ('not_started', 'draft', 'sent', 'viewed', 'signed', 'declined', 'voided', 'expired')),
  walkthrough_status   text not null default 'pending'
                         check (walkthrough_status in ('pending', 'scheduled', 'completed', 'canceled', 'rescheduled')),
  welcome_status       text not null default 'draft'
                         check (welcome_status in ('draft', 'queued', 'sent', 'failed')),
  project_share_status text not null default 'pending'
                         check (project_share_status in ('pending', 'active', 'revoked', 'expired')),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists idx_onboarding_workflows_org_stage
  on onboarding_workflows (org_id, stage, updated_at desc);

create table if not exists onboarding_steps (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations (id) on delete cascade,
  workflow_id   uuid not null references onboarding_workflows (id) on delete cascade,
  step_key      text not null
                  check (
                    step_key in (
                      'contract_sent',
                      'contract_signed',
                      'welcome_sent',
                      'walkthrough_scheduled',
                      'project_shared',
                      'inventory_in_progress',
                      'pricing_in_progress',
                      'sale_ready'
                    )
                  ),
  title         text not null,
  description   text not null default '',
  status        text not null default 'pending'
                  check (status in ('pending', 'in_progress', 'completed', 'blocked')),
  sort_order    integer not null,
  completed_at  timestamptz,
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (workflow_id, step_key)
);

create index if not exists idx_onboarding_steps_workflow_order
  on onboarding_steps (workflow_id, sort_order);

create table if not exists contracts (
  id                   uuid primary key default gen_random_uuid(),
  org_id               uuid not null references organizations (id) on delete cascade,
  assignment_id        uuid not null references client_project_assignments (id) on delete cascade,
  provider             text not null default 'docusign'
                         check (provider in ('docusign', 'dropbox_sign', 'manual')),
  status               text not null default 'draft'
                         check (status in ('draft', 'sent', 'viewed', 'signed', 'declined', 'voided', 'expired')),
  template_name        text,
  external_contract_id text,
  signer_name          text,
  signer_email         text,
  signed_at            timestamptz,
  metadata             jsonb not null default '{}'::jsonb,
  created_by           uuid references auth.users (id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists idx_contracts_assignment_created
  on contracts (assignment_id, created_at desc);

create table if not exists contract_events (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations (id) on delete cascade,
  contract_id uuid not null references contracts (id) on delete cascade,
  event_type  text not null,
  payload     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists idx_contract_events_contract_created
  on contract_events (contract_id, created_at desc);

create table if not exists walkthrough_sessions (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references organizations (id) on delete cascade,
  assignment_id     uuid not null references client_project_assignments (id) on delete cascade,
  provider          text not null default 'calendly'
                      check (provider in ('calendly', 'google_meet', 'manual')),
  status            text not null default 'pending'
                      check (status in ('pending', 'scheduled', 'completed', 'canceled', 'rescheduled')),
  external_event_id text,
  meeting_url       text,
  scheduled_start_at timestamptz,
  scheduled_end_at   timestamptz,
  notes             text,
  metadata          jsonb not null default '{}'::jsonb,
  created_by        uuid references auth.users (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_walkthrough_sessions_assignment_created
  on walkthrough_sessions (assignment_id, created_at desc);

create table if not exists walkthrough_events (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations (id) on delete cascade,
  walkthrough_id  uuid not null references walkthrough_sessions (id) on delete cascade,
  event_type      text not null,
  payload         jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists idx_walkthrough_events_walkthrough_created
  on walkthrough_events (walkthrough_id, created_at desc);

create table if not exists welcome_messages (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organizations (id) on delete cascade,
  assignment_id uuid not null references client_project_assignments (id) on delete cascade,
  provider     text not null default 'manual',
  status       text not null default 'draft'
                 check (status in ('draft', 'queued', 'sent', 'failed')),
  subject      text not null,
  body         text not null default '',
  sent_at      timestamptz,
  metadata     jsonb not null default '{}'::jsonb,
  created_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_welcome_messages_assignment_created
  on welcome_messages (assignment_id, created_at desc);

create table if not exists project_share_links (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references organizations (id) on delete cascade,
  assignment_id    uuid not null references client_project_assignments (id) on delete cascade,
  project_id       uuid not null references projects (id) on delete cascade,
  token_hash       text not null unique,
  status           text not null default 'active'
                     check (status in ('active', 'revoked', 'expired')),
  expires_at       timestamptz,
  last_accessed_at timestamptz,
  created_by       uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create unique index if not exists idx_project_share_links_active_assignment
  on project_share_links (assignment_id)
  where status = 'active';

create index if not exists idx_project_share_links_project_status
  on project_share_links (project_id, status, created_at desc);

create table if not exists project_transparency_events (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations (id) on delete cascade,
  project_id    uuid not null references projects (id) on delete cascade,
  assignment_id uuid references client_project_assignments (id) on delete set null,
  event_type    text not null
                  check (
                    event_type in (
                      'client_assigned',
                      'share_link_created',
                      'project_published',
                      'inventory_created',
                      'inventory_updated',
                      'pricing_updated',
                      'milestone_updated'
                    )
                  ),
  title         text not null,
  body          text,
  payload       jsonb not null default '{}'::jsonb,
  created_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now()
);

create index if not exists idx_project_transparency_events_project_created
  on project_transparency_events (project_id, created_at desc);

create index if not exists idx_project_transparency_events_assignment_created
  on project_transparency_events (assignment_id, created_at desc)
  where assignment_id is not null;

alter table client_profiles enable row level security;
alter table client_project_assignments enable row level security;
alter table onboarding_workflows enable row level security;
alter table onboarding_steps enable row level security;
alter table contracts enable row level security;
alter table contract_events enable row level security;
alter table walkthrough_sessions enable row level security;
alter table walkthrough_events enable row level security;
alter table welcome_messages enable row level security;
alter table project_share_links enable row level security;
alter table project_transparency_events enable row level security;

create policy "Org members can view client profiles"
  on client_profiles for select
  to authenticated
  using (
    exists (
      select 1 from org_members
      where org_members.org_id = client_profiles.org_id
        and org_members.user_id = auth.uid()
    )
  );

create policy "Admins can manage client profiles"
  on client_profiles for all
  to authenticated
  using (
    exists (
      select 1 from org_members
      where org_members.org_id = client_profiles.org_id
        and org_members.user_id = auth.uid()
        and org_members.role in ('superadmin', 'admin')
    )
  )
  with check (
    exists (
      select 1 from org_members
      where org_members.org_id = client_profiles.org_id
        and org_members.user_id = auth.uid()
        and org_members.role in ('superadmin', 'admin')
    )
  );

create policy "Org members can view client project assignments"
  on client_project_assignments for select
  to authenticated
  using (
    exists (
      select 1 from org_members
      where org_members.org_id = client_project_assignments.org_id
        and org_members.user_id = auth.uid()
    )
  );

create policy "Admins can manage client project assignments"
  on client_project_assignments for all
  to authenticated
  using (
    exists (
      select 1 from org_members
      where org_members.org_id = client_project_assignments.org_id
        and org_members.user_id = auth.uid()
        and org_members.role in ('superadmin', 'admin')
    )
  )
  with check (
    exists (
      select 1 from org_members
      where org_members.org_id = client_project_assignments.org_id
        and org_members.user_id = auth.uid()
        and org_members.role in ('superadmin', 'admin')
    )
  );

create policy "Org members can view onboarding workflows"
  on onboarding_workflows for select
  to authenticated
  using (
    exists (
      select 1 from org_members
      where org_members.org_id = onboarding_workflows.org_id
        and org_members.user_id = auth.uid()
    )
  );

create policy "Admins can manage onboarding workflows"
  on onboarding_workflows for all
  to authenticated
  using (
    exists (
      select 1 from org_members
      where org_members.org_id = onboarding_workflows.org_id
        and org_members.user_id = auth.uid()
        and org_members.role in ('superadmin', 'admin')
    )
  )
  with check (
    exists (
      select 1 from org_members
      where org_members.org_id = onboarding_workflows.org_id
        and org_members.user_id = auth.uid()
        and org_members.role in ('superadmin', 'admin')
    )
  );

create policy "Org members can view onboarding steps"
  on onboarding_steps for select
  to authenticated
  using (
    exists (
      select 1 from org_members
      where org_members.org_id = onboarding_steps.org_id
        and org_members.user_id = auth.uid()
    )
  );

create policy "Admins can manage onboarding steps"
  on onboarding_steps for all
  to authenticated
  using (
    exists (
      select 1 from org_members
      where org_members.org_id = onboarding_steps.org_id
        and org_members.user_id = auth.uid()
        and org_members.role in ('superadmin', 'admin')
    )
  )
  with check (
    exists (
      select 1 from org_members
      where org_members.org_id = onboarding_steps.org_id
        and org_members.user_id = auth.uid()
        and org_members.role in ('superadmin', 'admin')
    )
  );

create policy "Org members can view onboarding contracts"
  on contracts for select
  to authenticated
  using (
    exists (
      select 1 from org_members
      where org_members.org_id = contracts.org_id
        and org_members.user_id = auth.uid()
    )
  );

create policy "Admins can manage onboarding contracts"
  on contracts for all
  to authenticated
  using (
    exists (
      select 1 from org_members
      where org_members.org_id = contracts.org_id
        and org_members.user_id = auth.uid()
        and org_members.role in ('superadmin', 'admin')
    )
  )
  with check (
    exists (
      select 1 from org_members
      where org_members.org_id = contracts.org_id
        and org_members.user_id = auth.uid()
        and org_members.role in ('superadmin', 'admin')
    )
  );

create policy "Org members can view contract events"
  on contract_events for select
  to authenticated
  using (
    exists (
      select 1 from org_members
      where org_members.org_id = contract_events.org_id
        and org_members.user_id = auth.uid()
    )
  );

create policy "Admins can manage contract events"
  on contract_events for all
  to authenticated
  using (
    exists (
      select 1 from org_members
      where org_members.org_id = contract_events.org_id
        and org_members.user_id = auth.uid()
        and org_members.role in ('superadmin', 'admin')
    )
  )
  with check (
    exists (
      select 1 from org_members
      where org_members.org_id = contract_events.org_id
        and org_members.user_id = auth.uid()
        and org_members.role in ('superadmin', 'admin')
    )
  );

create policy "Org members can view walkthrough sessions"
  on walkthrough_sessions for select
  to authenticated
  using (
    exists (
      select 1 from org_members
      where org_members.org_id = walkthrough_sessions.org_id
        and org_members.user_id = auth.uid()
    )
  );

create policy "Admins can manage walkthrough sessions"
  on walkthrough_sessions for all
  to authenticated
  using (
    exists (
      select 1 from org_members
      where org_members.org_id = walkthrough_sessions.org_id
        and org_members.user_id = auth.uid()
        and org_members.role in ('superadmin', 'admin')
    )
  )
  with check (
    exists (
      select 1 from org_members
      where org_members.org_id = walkthrough_sessions.org_id
        and org_members.user_id = auth.uid()
        and org_members.role in ('superadmin', 'admin')
    )
  );

create policy "Org members can view walkthrough events"
  on walkthrough_events for select
  to authenticated
  using (
    exists (
      select 1 from org_members
      where org_members.org_id = walkthrough_events.org_id
        and org_members.user_id = auth.uid()
    )
  );

create policy "Admins can manage walkthrough events"
  on walkthrough_events for all
  to authenticated
  using (
    exists (
      select 1 from org_members
      where org_members.org_id = walkthrough_events.org_id
        and org_members.user_id = auth.uid()
        and org_members.role in ('superadmin', 'admin')
    )
  )
  with check (
    exists (
      select 1 from org_members
      where org_members.org_id = walkthrough_events.org_id
        and org_members.user_id = auth.uid()
        and org_members.role in ('superadmin', 'admin')
    )
  );

create policy "Org members can view welcome messages"
  on welcome_messages for select
  to authenticated
  using (
    exists (
      select 1 from org_members
      where org_members.org_id = welcome_messages.org_id
        and org_members.user_id = auth.uid()
    )
  );

create policy "Admins can manage welcome messages"
  on welcome_messages for all
  to authenticated
  using (
    exists (
      select 1 from org_members
      where org_members.org_id = welcome_messages.org_id
        and org_members.user_id = auth.uid()
        and org_members.role in ('superadmin', 'admin')
    )
  )
  with check (
    exists (
      select 1 from org_members
      where org_members.org_id = welcome_messages.org_id
        and org_members.user_id = auth.uid()
        and org_members.role in ('superadmin', 'admin')
    )
  );

create policy "Org members can view project share links"
  on project_share_links for select
  to authenticated
  using (
    exists (
      select 1 from org_members
      where org_members.org_id = project_share_links.org_id
        and org_members.user_id = auth.uid()
    )
  );

create policy "Admins can manage project share links"
  on project_share_links for all
  to authenticated
  using (
    exists (
      select 1 from org_members
      where org_members.org_id = project_share_links.org_id
        and org_members.user_id = auth.uid()
        and org_members.role in ('superadmin', 'admin')
    )
  )
  with check (
    exists (
      select 1 from org_members
      where org_members.org_id = project_share_links.org_id
        and org_members.user_id = auth.uid()
        and org_members.role in ('superadmin', 'admin')
    )
  );

create policy "Org members can view project transparency events"
  on project_transparency_events for select
  to authenticated
  using (
    exists (
      select 1 from org_members
      where org_members.org_id = project_transparency_events.org_id
        and org_members.user_id = auth.uid()
    )
  );

create policy "Admins can manage project transparency events"
  on project_transparency_events for all
  to authenticated
  using (
    exists (
      select 1 from org_members
      where org_members.org_id = project_transparency_events.org_id
        and org_members.user_id = auth.uid()
        and org_members.role in ('superadmin', 'admin')
    )
  )
  with check (
    exists (
      select 1 from org_members
      where org_members.org_id = project_transparency_events.org_id
        and org_members.user_id = auth.uid()
        and org_members.role in ('superadmin', 'admin')
    )
  );

insert into permissions (id, description) values
  ('onboarding:view', 'View client onboarding data'),
  ('onboarding:create', 'Create clients and assignments'),
  ('onboarding:update', 'Update onboarding progress'),
  ('onboarding:share', 'Create and revoke client share links')
on conflict (id) do nothing;

insert into role_permissions (org_role_id, permission_id)
select r.id, p.id
from org_roles r
cross join permissions p
where r.name = 'superadmin' and r.org_id is null
  and p.id in ('onboarding:view', 'onboarding:create', 'onboarding:update', 'onboarding:share')
on conflict (org_role_id, permission_id) do nothing;

insert into role_permissions (org_role_id, permission_id)
select r.id, p.id
from org_roles r
cross join permissions p
where r.name = 'admin' and r.org_id is null
  and p.id in ('onboarding:view', 'onboarding:create', 'onboarding:update', 'onboarding:share')
on conflict (org_role_id, permission_id) do nothing;

insert into role_permissions (org_role_id, permission_id)
select r.id, p.id
from org_roles r
cross join permissions p
where r.name = 'member' and r.org_id is null
  and p.id in ('onboarding:view')
on conflict (org_role_id, permission_id) do nothing;