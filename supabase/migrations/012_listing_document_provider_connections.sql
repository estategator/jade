-- =========================
-- Listing & Document Provider Connections (multi-provider support)
-- =========================
-- Adds listing_provider_connections for sale publishing integrations
-- (EstateSales.NET, etc.) and document_provider_connections for document
-- signing integrations (DocuSign, etc.). Follows the same pattern as
-- payment_provider_connections from migration 009.

-- ── Listing Provider Connections ─────────────────────────────

create table if not exists listing_provider_connections (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references organizations (id) on delete cascade,
  provider            text not null check (provider in ('estatesales_net')),
  external_account_id text not null,         -- EstateSales.NET organization ID
  status              text not null default 'pending'
                        check (status in ('pending', 'connected', 'error', 'disconnected')),
  is_default          boolean not null default false,
  credentials_enc     jsonb,                 -- encrypted provider credentials (username, API key, etc.)
  metadata            jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  -- One connection per provider per org
  unique (org_id, provider)
);

-- Fast lookup by org for settings page
create index if not exists idx_lpc_org
  on listing_provider_connections (org_id);

-- Ensure at most one default listing provider per org
create unique index if not exists idx_lpc_org_default
  on listing_provider_connections (org_id)
  where is_default = true and status != 'disconnected';

-- RLS
alter table listing_provider_connections enable row level security;

create policy "Org members can view listing connections"
  on listing_provider_connections for select
  to authenticated
  using (
    exists (
      select 1 from org_members
      where org_members.org_id = listing_provider_connections.org_id
        and org_members.user_id = auth.uid()
    )
  );

-- ── Document Provider Connections ────────────────────────────

create table if not exists document_provider_connections (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references organizations (id) on delete cascade,
  provider            text not null check (provider in ('docusign')),
  external_account_id text not null,         -- DocuSign account ID
  status              text not null default 'pending'
                        check (status in ('pending', 'connected', 'error', 'disconnected')),
  is_default          boolean not null default false,
  access_token_enc    text,                  -- encrypted OAuth token
  refresh_token_enc   text,                  -- encrypted refresh token
  token_expires_at    timestamptz,
  metadata            jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  -- One connection per provider per org
  unique (org_id, provider)
);

-- Fast lookup by org for settings page
create index if not exists idx_dpc_org
  on document_provider_connections (org_id);

-- Ensure at most one default document provider per org
create unique index if not exists idx_dpc_org_default
  on document_provider_connections (org_id)
  where is_default = true and status != 'disconnected';

-- RLS
alter table document_provider_connections enable row level security;

create policy "Org members can view document connections"
  on document_provider_connections for select
  to authenticated
  using (
    exists (
      select 1 from org_members
      where org_members.org_id = document_provider_connections.org_id
        and org_members.user_id = auth.uid()
    )
  );
