-- =========================
-- Payment Provider Connections (multi-provider support)
-- =========================
-- Normalizes financial account connections (Stripe, Square, Clover)
-- per organization. Replaces the single-provider stripe_account_id
-- and stripe_onboarding_complete columns with a provider-agnostic model.

create table if not exists payment_provider_connections (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references organizations (id) on delete cascade,
  provider            text not null check (provider in ('stripe', 'square', 'clover')),
  external_account_id text not null,         -- Stripe acct_*, Square merchant_id, Clover merchant_id
  status              text not null default 'pending'
                        check (status in ('pending', 'connected', 'incomplete', 'error', 'disconnected')),
  onboarding_complete boolean not null default false,
  is_default          boolean not null default false,
  access_token_enc    text,                  -- encrypted OAuth token (Square/Clover)
  refresh_token_enc   text,                  -- encrypted refresh token (Square)
  token_expires_at    timestamptz,
  metadata            jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  -- One connection per provider per org
  unique (org_id, provider)
);

-- Fast lookup by external account ID (webhook processing)
create index if not exists idx_ppc_external_account
  on payment_provider_connections (provider, external_account_id)
  where status != 'disconnected';

-- Fast lookup by org for settings page
create index if not exists idx_ppc_org
  on payment_provider_connections (org_id);

-- Ensure at most one default provider per org
create unique index if not exists idx_ppc_org_default
  on payment_provider_connections (org_id)
  where is_default = true and status != 'disconnected';

-- RLS
alter table payment_provider_connections enable row level security;

create policy "Org members can view provider connections"
  on payment_provider_connections for select
  to authenticated
  using (
    exists (
      select 1 from org_members
      where org_members.org_id = payment_provider_connections.org_id
        and org_members.user_id = auth.uid()
    )
  );

-- Backfill existing Stripe connections
insert into payment_provider_connections (org_id, provider, external_account_id, status, onboarding_complete, is_default)
select
  id as org_id,
  'stripe' as provider,
  stripe_account_id as external_account_id,
  case
    when stripe_onboarding_complete then 'connected'
    else 'incomplete'
  end as status,
  stripe_onboarding_complete as onboarding_complete,
  true as is_default
from organizations
where stripe_account_id is not null
on conflict (org_id, provider) do nothing;
