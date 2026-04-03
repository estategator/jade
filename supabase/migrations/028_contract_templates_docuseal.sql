-- =========================
-- Contract templates + Docuseal provider support
-- =========================

-- ── contract_templates ───────────────────────────────────────
-- Org-scoped reusable contract templates backed by Docuseal.

create table if not exists contract_templates (
  id                    uuid primary key default gen_random_uuid(),
  org_id                uuid not null references organizations (id) on delete cascade,
  name                  text not null,
  agreement_type        text not null default 'estate_sale',
  docuseal_template_id  integer,
  docuseal_slug         text,
  preview_url           text,
  document_urls         jsonb not null default '[]'::jsonb,
  status                text not null default 'active'
                          check (status in ('active', 'archived')),
  created_by            uuid references auth.users (id) on delete set null,
  metadata              jsonb not null default '{}'::jsonb,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists idx_contract_templates_org_status
  on contract_templates (org_id, status);

alter table contract_templates enable row level security;

create policy "Org members can view contract templates"
  on contract_templates for select
  to authenticated
  using (
    exists (
      select 1 from org_members
      where org_members.org_id = contract_templates.org_id
        and org_members.user_id = auth.uid()
    )
  );

-- ── Add contract_template_id FK on contracts ─────────────────

alter table contracts
  add column if not exists contract_template_id uuid references contract_templates (id) on delete set null;

create index if not exists idx_contracts_template
  on contracts (contract_template_id)
  where contract_template_id is not null;

-- ── Expand contracts.provider to include 'docuseal' ──────────

-- Drop old check constraint, re-create with docuseal included.
do $$
begin
  -- The original constraint name from 010 migration
  alter table contracts drop constraint if exists contracts_provider_check;
  -- Re-add with docuseal
  alter table contracts
    add constraint contracts_provider_check
      check (provider in ('docusign', 'dropbox_sign', 'manual', 'docuseal'));
exception
  when undefined_object then
    -- Constraint may have a different auto-generated name; try the common pattern
    null;
end;
$$;

-- ── Expand document_provider_connections for docuseal ─────────
-- Not required for v1 (platform-managed account), but future-proofs the schema.

comment on table contract_templates is 'Org-scoped reusable contract templates backed by Docuseal';
comment on column contract_templates.docuseal_template_id is 'Template ID on the Docuseal platform';
comment on column contract_templates.docuseal_slug is 'Template slug on Docuseal (used for embed URLs)';
comment on column contracts.contract_template_id is 'Optional reference to a reusable contract template';
