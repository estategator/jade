-- =========================
-- Active-only unique constraints for project assignments
-- =========================
-- Replace strict unique constraints so only 'active' assignments
-- enforce one-project-one-client, while archived rows are kept
-- for history.

-- Drop the org-level strict unique from migration 015
do $$
begin
  if exists (
    select 1 from pg_constraint where conname = 'client_project_assignments_org_project_unique'
  ) then
    alter table client_project_assignments
      drop constraint client_project_assignments_org_project_unique;
  end if;
end;
$$;

-- Drop the table-level strict unique from migration 010
-- (Postgres auto-names inline unique as {table}_{columns}_key)
do $$
begin
  if exists (
    select 1 from pg_constraint where conname = 'client_project_assignments_client_profile_id_project_id_key'
  ) then
    alter table client_project_assignments
      drop constraint client_project_assignments_client_profile_id_project_id_key;
  end if;
end;
$$;

-- Partial unique: only one active assignment per project per org
create unique index if not exists idx_client_assignments_active_org_project
  on client_project_assignments (org_id, project_id)
  where status = 'active';

-- Partial unique: same client+project can only be active once
create unique index if not exists idx_client_assignments_active_client_project
  on client_project_assignments (client_profile_id, project_id)
  where status = 'active';

-- Index for filtering assignments by client and status (used by detail queries)
create index if not exists idx_client_assignments_client_status
  on client_project_assignments (client_profile_id, status);
