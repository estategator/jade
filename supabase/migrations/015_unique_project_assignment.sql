-- =========================
-- Enforce one-project-to-one-client assignment
-- =========================
-- A project can only be assigned to a single client at a time.
-- The existing unique(client_profile_id, project_id) allows the same project
-- to be assigned to multiple clients. This adds a unique constraint on
-- (org_id, project_id) so each project has at most one active assignment.

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'client_project_assignments_org_project_unique'
  ) then
    alter table client_project_assignments
      add constraint client_project_assignments_org_project_unique
        unique (org_id, project_id);
  end if;
end;
$$;
