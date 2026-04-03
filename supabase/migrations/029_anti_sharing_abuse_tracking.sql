-- Migration: Anti-sharing abuse tracking tables
-- Supports progressive fair-use enforcement for Pro-tier orgs (5 seats)

-- ── 1. Individual abuse events (immutable log) ──────────────

create table if not exists org_abuse_events (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id) on delete cascade,
  actor_user_id uuid not null,
  rule_key      text not null,               -- e.g. 'invite_burst', 'churn_cycle'
  weight        smallint not null default 0,
  metadata      jsonb not null default '{}',  -- free-form context
  created_at    timestamptz not null default now()
);

create index idx_abuse_events_org_created
  on org_abuse_events (org_id, created_at desc);

create index idx_abuse_events_rule_created
  on org_abuse_events (rule_key, created_at desc);

-- ── 2. Aggregated org-level abuse state (mutable singleton) ─

create table if not exists org_abuse_state (
  org_id            uuid primary key references organizations(id) on delete cascade,
  score_24h         smallint not null default 0,
  score_7d          smallint not null default 0,
  score_30d         smallint not null default 0,
  strike_count      smallint not null default 0,
  enforcement_level text not null default 'none',  -- none | warning | cooldown | lock
  cooldown_until    timestamptz,
  lock_until        timestamptz,
  updated_at        timestamptz not null default now()
);

-- ── 3. Hashed session signals for device-sharing detection ──

create table if not exists user_session_signals (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null,
  org_id        uuid references organizations(id) on delete set null,
  ip_hash       text not null,    -- SHA-256 of IP, never raw
  ua_hash       text not null,    -- SHA-256 of User-Agent
  device_hash   text not null,    -- SHA-256 of composite fingerprint
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now()
);

create unique index idx_session_signals_user_device
  on user_session_signals (user_id, device_hash);

create index idx_session_signals_org_device
  on user_session_signals (org_id, device_hash, last_seen_at desc);

-- ── 4. RLS policies ─────────────────────────────────────────

alter table org_abuse_events enable row level security;
alter table org_abuse_state  enable row level security;
alter table user_session_signals enable row level security;

-- Service-role only — no direct browser access
create policy "Service role only" on org_abuse_events
  for all using (false);

create policy "Service role only" on org_abuse_state
  for all using (false);

create policy "Service role only" on user_session_signals
  for all using (false);
