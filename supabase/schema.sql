-- ============================================================
-- Curator – Supabase Schema
-- Run this in the Supabase SQL Editor (or via a migration).
-- Supabase Auth (auth.users) is managed automatically.
-- ============================================================

-- =========================
-- 1. Waitlist / interest sign-ups (landing page)
-- =========================
create table if not exists curator_interest_signups (
  id           uuid primary key default gen_random_uuid(),
  user_email   text not null unique,
  interest_type text not null default 'waitlist',
  source       text not null default 'landing_page',
  subscribed   boolean not null default true,
  processed    boolean not null default false,
  created_at   timestamptz not null default now()
);

-- =========================
-- 2. User profiles (1-to-1 with auth.users)
-- =========================
create table if not exists profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null default '',
  avatar_url  text,
  role        text not null default 'user'
                check (role in ('user', 'admin', 'developer', 'support')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Auto-create a profile row when a new user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========================
-- 3. Organizations
-- =========================
create table if not exists organizations (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  slug            text not null unique,
  cover_image_url text,
  created_by      uuid not null references auth.users (id) on delete cascade,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- =========================
-- 4. Organization members (many-to-many users <-> orgs)
--    The user who creates the org is auto-inserted as 'superadmin'.
-- =========================
create table if not exists org_members (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  role        text not null default 'member'
                check (role in ('superadmin', 'admin', 'member')),
  status      text not null default 'active'
                check (status in ('active', 'suspended')),
  created_at  timestamptz not null default now(),
  unique (org_id, user_id)
);

create index if not exists idx_org_members_user
  on org_members (user_id);

create index if not exists idx_org_members_active
  on org_members (org_id, user_id) where status = 'active';

-- Covers RLS admin/superadmin checks as index-only scan (avoids heap fetch for role)
create index if not exists idx_org_members_org_user_role
  on org_members (org_id, user_id, role);

-- =========================
-- 4b. Organization invitations (pending invites)
-- =========================
create table if not exists organization_invitations (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations (id) on delete cascade,
  email           text not null,
  invited_by_id   uuid not null references auth.users (id) on delete cascade,
  invited_user_id uuid references auth.users (id) on delete set null,
  requested_role  text not null default 'member'
                    check (requested_role in ('admin', 'member')),
  status          text not null default 'pending'
                    check (status in ('pending', 'accepted', 'declined', 'canceled')),
  accepted_at     timestamptz,
  responded_at    timestamptz,
  created_at      timestamptz not null default now(),
  unique (org_id, email)
);

create index if not exists idx_org_invitations_org
  on organization_invitations (org_id);

create index if not exists idx_org_invitations_email
  on organization_invitations (email);

create index if not exists idx_org_invitations_invited_user
  on organization_invitations (invited_user_id)
  where invited_user_id is not null;

-- Pending-invite queue: getPendingInvitations, pending count check
create index if not exists idx_org_invitations_org_pending
  on organization_invitations (org_id, created_at desc)
  where status = 'pending';

-- syncPendingInvitesForUser: email lookup for unclaimed pending invites
create index if not exists idx_org_invitations_email_pending
  on organization_invitations (email)
  where status = 'pending' and invited_user_id is null;

-- =========================
-- 4c. User notifications (extensible inbox)
-- =========================
create table if not exists user_notifications (
  id                uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references auth.users (id) on delete cascade,
  org_id            uuid references organizations (id) on delete cascade,
  kind              text not null,                     -- e.g. 'org_invite'
  source_table      text not null,                     -- e.g. 'organization_invitations'
  source_id         uuid not null,                     -- FK to the source row
  title             text not null,
  body              text,
  payload           jsonb not null default '{}'::jsonb, -- extra context for renderers
  read_at           timestamptz,
  resolved_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (recipient_user_id, source_table, source_id)
);

create index if not exists idx_user_notifications_recipient
  on user_notifications (recipient_user_id, resolved_at nulls first, created_at desc);

create index if not exists idx_user_notifications_source
  on user_notifications (source_table, source_id);

-- Unread notification count: .is('resolved_at', null).is('read_at', null)
create index if not exists idx_user_notifications_unread
  on user_notifications (recipient_user_id, created_at desc)
  where resolved_at is null and read_at is null;

-- resolveNotificationsForSource: find unresolved by source
create index if not exists idx_user_notifications_source_unresolved
  on user_notifications (source_table, source_id)
  where resolved_at is null;

-- Enable Realtime so clients can subscribe to new notifications
alter publication supabase_realtime add table user_notifications;

-- =========================
-- 5. Projects (belong to an organization)
-- =========================
create table if not exists projects (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations (id) on delete cascade,
  name            text not null,
  description     text not null default '',
  cover_image_url text,
  published       boolean not null default false,
  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_projects_org
  on projects (org_id);

-- =========================
-- 6. Inventory items (now scoped to a project, optionally)
-- =========================
create table if not exists inventory_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  org_id      uuid references organizations (id) on delete set null,
  project_id  uuid references projects (id) on delete set null,
  name        text not null,
  description text not null default '',
  category    text not null default 'Uncategorized',
  price       numeric(12,2) not null default 0,
  condition   text not null default 'Good',
  status      text not null default 'available'
                check (status in ('available', 'sold', 'reserved')),
  quantity    integer not null default 1,
  stripe_payment_id text,
  sold_at     timestamptz,
  original_image_url text,
  thumbnail_url      text,
  medium_image_url   text,
  processing_status  text not null default 'none'
                check (processing_status in ('none', 'queued', 'processing', 'analyzing', 'complete', 'failed')),
  ai_insights        jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_inventory_items_user_created
  on inventory_items (user_id, created_at desc);

create index if not exists idx_inventory_items_org
  on inventory_items (org_id);

-- Project-scoped listings: getInventoryItems, getPublicProjectItems
create index if not exists idx_inventory_items_project_created
  on inventory_items (project_id, created_at desc)
  where project_id is not null;

-- Org + status filter: getRevenueByMonth (.eq('org_id',X).eq('status','sold'))
create index if not exists idx_inventory_items_org_status
  on inventory_items (org_id, status);

-- Cleanup-images cron: completed items older than threshold
create index if not exists idx_inventory_items_processing_cleanup
  on inventory_items (processing_status, created_at)
  where processing_status = 'complete';

-- Backfill sold_at for existing sold items (run once after adding the column):
-- ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS sold_at timestamptz;
-- UPDATE inventory_items SET sold_at = updated_at WHERE status = 'sold' AND sold_at IS NULL;

-- ============================================================
-- Row Level Security
-- ============================================================

-- ---- curator_interest_signups ----
alter table curator_interest_signups enable row level security;

create policy "Anyone can sign up for waitlist"
  on curator_interest_signups for insert
  to anon, authenticated
  with check (true);

-- ---- profiles ----
alter table profiles enable row level security;

create policy "Users can view any profile"
  on profiles for select
  to authenticated
  using (true);

create policy "Users can update their own profile"
  on profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ---- organizations ----
alter table organizations enable row level security;

-- Members can view their orgs
create policy "Org members can view org"
  on organizations for select
  to authenticated
  using (
    exists (
      select 1 from org_members
      where org_members.org_id = id
        and org_members.user_id = auth.uid()
    )
  );

-- Any authenticated user can create an org
create policy "Authenticated users can create orgs"
  on organizations for insert
  to authenticated
  with check (auth.uid() = created_by);

-- Only superadmin can update the org
create policy "Superadmins can update org"
  on organizations for update
  to authenticated
  using (
    exists (
      select 1 from org_members
      where org_members.org_id = id
        and org_members.user_id = auth.uid()
        and org_members.role = 'superadmin'
    )
  );

-- Only superadmin can delete the org
create policy "Superadmins can delete org"
  on organizations for delete
  to authenticated
  using (
    exists (
      select 1 from org_members
      where org_members.org_id = id
        and org_members.user_id = auth.uid()
        and org_members.role = 'superadmin'
    )
  );

-- ---- org_members ----
alter table org_members enable row level security;

-- Members can see the membership list of their orgs
create policy "Members can view org members"
  on org_members for select
  to authenticated
  using (
    exists (
      select 1 from org_members as my
      where my.org_id = org_members.org_id
        and my.user_id = auth.uid()
    )
  );

-- Superadmin / admin can add members
create policy "Admins can add members"
  on org_members for insert
  to authenticated
  with check (
    exists (
      select 1 from org_members as my
      where my.org_id = org_members.org_id
        and my.user_id = auth.uid()
        and my.role in ('superadmin', 'admin')
    )
    -- Also allow the org creator to insert themselves as first member
    or (
      auth.uid() = user_id
      and exists (
        select 1 from organizations
        where organizations.id = org_members.org_id
          and organizations.created_by = auth.uid()
      )
    )
  );

-- Superadmin / admin can update member roles
create policy "Admins can update members"
  on org_members for update
  to authenticated
  using (
    exists (
      select 1 from org_members as my
      where my.org_id = org_members.org_id
        and my.user_id = auth.uid()
        and my.role in ('superadmin', 'admin')
    )
  );

-- Superadmin / admin can remove members; members can remove themselves
create policy "Admins can remove members or self-remove"
  on org_members for delete
  to authenticated
  using (
    auth.uid() = user_id
    or exists (
      select 1 from org_members as my
      where my.org_id = org_members.org_id
        and my.user_id = auth.uid()
        and my.role in ('superadmin', 'admin')
    )
  );

-- ---- organization_invitations ----
alter table organization_invitations enable row level security;

-- Org members can view invitations in their org, and invited users can see their own
create policy "Members can view invitations"
  on organization_invitations for select
  to authenticated
  using (
    organization_invitations.invited_user_id = auth.uid()
    or exists (
      select 1 from org_members as my
      where my.org_id = organization_invitations.org_id
        and my.user_id = auth.uid()
    )
  );

-- Superadmin / admin can create invitations
create policy "Admins can create invitations"
  on organization_invitations for insert
  to authenticated
  with check (
    exists (
      select 1 from org_members as my
      where my.org_id = organization_invitations.org_id
        and my.user_id = auth.uid()
        and my.role in ('superadmin', 'admin')
    )
  );

-- Superadmin / admin can delete invitations
create policy "Admins can delete invitations"
  on organization_invitations for delete
  to authenticated
  using (
    exists (
      select 1 from org_members as my
      where my.org_id = organization_invitations.org_id
        and my.user_id = auth.uid()
        and my.role in ('superadmin', 'admin')
    )
  );

-- ---- user_notifications ----
alter table user_notifications enable row level security;

-- Users can view only their own notifications
create policy "Users can view own notifications"
  on user_notifications for select
  to authenticated
  using (recipient_user_id = auth.uid());

-- Users can update only their own notifications (mark read, resolve)
create policy "Users can update own notifications"
  on user_notifications for update
  to authenticated
  using (recipient_user_id = auth.uid())
  with check (recipient_user_id = auth.uid());

-- ---- projects ----
alter table projects enable row level security;

-- Org members can view projects in their orgs
create policy "Org members can view projects"
  on projects for select
  to authenticated
  using (
    exists (
      select 1 from org_members
      where org_members.org_id = projects.org_id
        and org_members.user_id = auth.uid()
    )
  );

-- Superadmin / admin can create projects
create policy "Admins can create projects"
  on projects for insert
  to authenticated
  with check (
    exists (
      select 1 from org_members
      where org_members.org_id = projects.org_id
        and org_members.user_id = auth.uid()
        and org_members.role in ('superadmin', 'admin')
    )
  );

-- Superadmin / admin can update projects
create policy "Admins can update projects"
  on projects for update
  to authenticated
  using (
    exists (
      select 1 from org_members
      where org_members.org_id = projects.org_id
        and org_members.user_id = auth.uid()
        and org_members.role in ('superadmin', 'admin')
    )
  );

-- Superadmin / admin can delete projects
create policy "Admins can delete projects"
  on projects for delete
  to authenticated
  using (
    exists (
      select 1 from org_members
      where org_members.org_id = projects.org_id
        and org_members.user_id = auth.uid()
        and org_members.role in ('superadmin', 'admin')
    )
  );

-- ---- inventory_items ----
alter table inventory_items enable row level security;

-- Users can view their own items OR items in orgs they belong to
create policy "Users can view own or org items"
  on inventory_items for select
  to authenticated
  using (
    auth.uid() = user_id
    or exists (
      select 1 from org_members
      where org_members.org_id = inventory_items.org_id
        and org_members.user_id = auth.uid()
    )
  );

create policy "Users can insert their own items"
  on inventory_items for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own items"
  on inventory_items for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own items"
  on inventory_items for delete
  to authenticated
  using (auth.uid() = user_id);

-- =========================
-- 7. Organization appearance settings
-- =========================
create table if not exists org_settings (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations (id) on delete cascade,
  settings      jsonb not null default '{}'::jsonb,
  enforced_keys text[] not null default '{}',
  updated_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (org_id)
);

create index if not exists idx_org_settings_org
  on org_settings (org_id);

-- =========================
-- 8. Per-user per-org appearance settings
-- =========================
create table if not exists user_org_settings (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  org_id      uuid not null references organizations (id) on delete cascade,
  settings    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, org_id)
);

create index if not exists idx_user_org_settings_user
  on user_org_settings (user_id);

-- ---- org_settings RLS ----
alter table org_settings enable row level security;

create policy "Org members can view org settings"
  on org_settings for select
  to authenticated
  using (
    exists (
      select 1 from org_members
      where org_members.org_id = org_settings.org_id
        and org_members.user_id = auth.uid()
    )
  );

create policy "Admins can insert org settings"
  on org_settings for insert
  to authenticated
  with check (
    exists (
      select 1 from org_members
      where org_members.org_id = org_settings.org_id
        and org_members.user_id = auth.uid()
        and org_members.role in ('superadmin', 'admin')
    )
  );

create policy "Admins can update org settings"
  on org_settings for update
  to authenticated
  using (
    exists (
      select 1 from org_members
      where org_members.org_id = org_settings.org_id
        and org_members.user_id = auth.uid()
        and org_members.role in ('superadmin', 'admin')
    )
  );

create policy "Admins can delete org settings"
  on org_settings for delete
  to authenticated
  using (
    exists (
      select 1 from org_members
      where org_members.org_id = org_settings.org_id
        and org_members.user_id = auth.uid()
        and org_members.role in ('superadmin', 'admin')
    )
  );

-- ---- user_org_settings RLS ----
alter table user_org_settings enable row level security;

create policy "Users can view own org settings"
  on user_org_settings for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own org settings"
  on user_org_settings for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from org_members
      where org_members.org_id = user_org_settings.org_id
        and org_members.user_id = auth.uid()
    )
  );

create policy "Users can update own org settings"
  on user_org_settings for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own org settings"
  on user_org_settings for delete
  to authenticated
  using (auth.uid() = user_id);

-- =========================
-- 9. Stripe Connect columns on organizations
-- =========================
alter table organizations
  add column if not exists stripe_account_id text,
  add column if not exists stripe_onboarding_complete boolean not null default false,
  add column if not exists subscription_tier text not null default 'free'
                check (subscription_tier in ('free', 'pro', 'enterprise')),
  add column if not exists stripe_subscription_id text;

-- Stripe Connect webhook: account.updated lookup by connected account ID
create index if not exists idx_organizations_stripe_account
  on organizations (stripe_account_id)
  where stripe_account_id is not null;

-- =========================
-- 9b. Stripe Billing columns on organizations (SaaS subscriptions)
-- =========================
alter table organizations
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_price_id text,
  add column if not exists subscription_status text not null default 'none'
                check (subscription_status in ('none', 'active', 'trialing', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'unpaid', 'paused')),
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists current_period_end timestamptz;

-- =========================
-- 10. Sales table (tracks completed transactions)
-- =========================
create table if not exists sales (
  id                          uuid primary key default gen_random_uuid(),
  inventory_item_id           uuid not null references inventory_items (id) on delete cascade,
  seller_org_id               uuid not null references organizations (id) on delete cascade,
  buyer_email                 text,
  amount                      numeric(12,2) not null,
  currency                    text not null default 'usd',
  stripe_checkout_session_id  text,
  stripe_payment_intent_id    text,
  stripe_connected_account_id text,
  status                      text not null default 'pending'
                                check (status in ('pending', 'completed', 'refunded', 'failed')),
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

create index if not exists idx_sales_seller_org
  on sales (seller_org_id);

create index if not exists idx_sales_item
  on sales (inventory_item_id);

-- Recent sales: .in('seller_org_id', X).order('created_at desc')
create index if not exists idx_sales_org_created
  on sales (seller_org_id, created_at desc);

-- Revenue query: .in('seller_org_id', X).eq('status', 'completed')
create index if not exists idx_sales_org_completed
  on sales (seller_org_id, amount)
  where status = 'completed';

-- ---- sales RLS ----
alter table sales enable row level security;

-- Org members can view sales for their organization
create policy "Org members can view org sales"
  on sales for select
  to authenticated
  using (
    exists (
      select 1 from org_members
      where org_members.org_id = sales.seller_org_id
        and org_members.user_id = auth.uid()
    )
  );

-- =========================
-- 11. RBAC — Permissions & Role-Permission Mappings
-- =========================

-- Canonical permission definitions
create table if not exists permissions (
  id          text primary key,                 -- e.g. 'org:update'
  description text not null default '',
  created_at  timestamptz not null default now()
);

-- Org-scoped role definitions (defaults + custom per org)
create table if not exists org_roles (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid references organizations (id) on delete cascade,  -- NULL = global default
  name        text not null,                     -- e.g. 'superadmin', 'admin', 'member', or custom
  description text not null default '',
  is_default  boolean not null default false,    -- true for the 3 built-in roles
  created_at  timestamptz not null default now(),
  unique (org_id, name)
);

-- Junction: which permissions each role grants
create table if not exists role_permissions (
  id            uuid primary key default gen_random_uuid(),
  org_role_id   uuid not null references org_roles (id) on delete cascade,
  permission_id text not null references permissions (id) on delete cascade,
  created_at    timestamptz not null default now(),
  unique (org_role_id, permission_id)
);

create index if not exists idx_role_permissions_role
  on role_permissions (org_role_id);

-- =========================
-- 12. Audit log
-- =========================
create table if not exists audit_log (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid references organizations (id) on delete set null,
  actor_id    uuid references auth.users (id) on delete set null,
  action      text not null,                     -- e.g. 'member.invited', 'org.deleted'
  target_type text,                              -- e.g. 'org_member', 'organization'
  target_id   text,                              -- the affected row id
  metadata    jsonb not null default '{}'::jsonb, -- extra context
  created_at  timestamptz not null default now()
);

create index if not exists idx_audit_log_org
  on audit_log (org_id, created_at desc);

create index if not exists idx_audit_log_actor
  on audit_log (actor_id, created_at desc);

-- ---- permissions RLS ----
alter table permissions enable row level security;

create policy "Authenticated users can view permissions"
  on permissions for select
  to authenticated
  using (true);

-- ---- org_roles RLS ----
alter table org_roles enable row level security;

-- Anyone can see default (global) roles; org members can see their org's custom roles
create policy "Users can view applicable roles"
  on org_roles for select
  to authenticated
  using (
    org_id is null
    or exists (
      select 1 from org_members
      where org_members.org_id = org_roles.org_id
        and org_members.user_id = auth.uid()
    )
  );

-- Only superadmin can create custom roles for their org
create policy "Superadmins can create custom roles"
  on org_roles for insert
  to authenticated
  with check (
    org_id is not null
    and is_default = false
    and exists (
      select 1 from org_members
      where org_members.org_id = org_roles.org_id
        and org_members.user_id = auth.uid()
        and org_members.role = 'superadmin'
    )
  );

-- Only superadmin can update custom roles
create policy "Superadmins can update custom roles"
  on org_roles for update
  to authenticated
  using (
    org_id is not null
    and is_default = false
    and exists (
      select 1 from org_members
      where org_members.org_id = org_roles.org_id
        and org_members.user_id = auth.uid()
        and org_members.role = 'superadmin'
    )
  );

-- Only superadmin can delete custom roles
create policy "Superadmins can delete custom roles"
  on org_roles for delete
  to authenticated
  using (
    org_id is not null
    and is_default = false
    and exists (
      select 1 from org_members
      where org_members.org_id = org_roles.org_id
        and org_members.user_id = auth.uid()
        and org_members.role = 'superadmin'
    )
  );

-- ---- role_permissions RLS ----
alter table role_permissions enable row level security;

create policy "Users can view role permissions"
  on role_permissions for select
  to authenticated
  using (
    exists (
      select 1 from org_roles
      where org_roles.id = role_permissions.org_role_id
        and (
          org_roles.org_id is null
          or exists (
            select 1 from org_members
            where org_members.org_id = org_roles.org_id
              and org_members.user_id = auth.uid()
          )
        )
    )
  );

-- ---- audit_log RLS ----
alter table audit_log enable row level security;

-- Admins of an org can view that org's audit log
create policy "Admins can view org audit log"
  on audit_log for select
  to authenticated
  using (
    exists (
      select 1 from org_members
      where org_members.org_id = audit_log.org_id
        and org_members.user_id = auth.uid()
        and org_members.role in ('superadmin', 'admin')
    )
  );

-- =========================
-- 13. Seed default permissions & role mappings
-- =========================

-- Canonical permissions
insert into permissions (id, description) values
  ('org:update',          'Update organization details'),
  ('org:delete',          'Delete the organization'),
  ('billing:manage',      'Manage subscription & Stripe Connect'),
  ('members:invite',      'Invite new members'),
  ('members:remove',      'Remove members'),
  ('members:update_role', 'Change member roles'),
  ('members:view',        'View member list'),
  ('projects:create',     'Create projects'),
  ('projects:update',     'Update projects'),
  ('projects:delete',     'Delete projects'),
  ('projects:view',       'View projects'),
  ('inventory:create',    'Create inventory items'),
  ('inventory:update',    'Update inventory items'),
  ('inventory:delete',    'Delete inventory items'),
  ('inventory:view',      'View inventory items'),
  ('settings:manage',     'Manage organization settings'),
  ('settings:view',       'View organization settings'),
  ('analytics:view',      'View dashboard analytics'),
  ('sales:view',          'View sales data')
on conflict (id) do nothing;

-- Default global roles (org_id IS NULL)
insert into org_roles (org_id, name, description, is_default) values
  (null, 'superadmin', 'Full control of the organization', true),
  (null, 'admin',      'Manage projects, members, and settings', true),
  (null, 'member',     'View and manage own inventory', true)
on conflict (org_id, name) do nothing;

-- Map permissions to default roles
-- superadmin gets everything
insert into role_permissions (org_role_id, permission_id)
select r.id, p.id
from org_roles r
cross join permissions p
where r.name = 'superadmin' and r.org_id is null
on conflict (org_role_id, permission_id) do nothing;

-- admin gets most permissions (not org:delete, billing:manage)
insert into role_permissions (org_role_id, permission_id)
select r.id, p.id
from org_roles r
cross join permissions p
where r.name = 'admin' and r.org_id is null
  and p.id in (
    'org:update',
    'members:invite', 'members:remove', 'members:update_role', 'members:view',
    'projects:create', 'projects:update', 'projects:delete', 'projects:view',
    'inventory:create', 'inventory:update', 'inventory:delete', 'inventory:view',
    'settings:manage', 'settings:view',
    'analytics:view', 'sales:view'
  )
on conflict (org_role_id, permission_id) do nothing;

-- member gets read + own-inventory permissions
insert into role_permissions (org_role_id, permission_id)
select r.id, p.id
from org_roles r
cross join permissions p
where r.name = 'member' and r.org_id is null
  and p.id in (
    'members:view',
    'projects:view',
    'inventory:create', 'inventory:update', 'inventory:delete', 'inventory:view',
    'settings:view',
    'analytics:view', 'sales:view'
  )
on conflict (org_role_id, permission_id) do nothing;

-- =========================
-- 14. Subscriptions table (canonical subscription storage)
-- =========================
create table if not exists subscriptions (
  id                      uuid primary key default gen_random_uuid(),
  org_id                  uuid not null references organizations (id) on delete cascade,
  tier                    text not null default 'free'
                            check (tier in ('free', 'pro', 'enterprise')),
  status                  text not null default 'none'
                            check (status in ('none', 'active', 'trialing', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'unpaid', 'paused')),
  stripe_subscription_id  text,
  stripe_customer_id      text,
  stripe_price_id         text,
  cancel_at_period_end    boolean not null default false,
  current_period_end      timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- Each org has at most one active subscription row
create unique index if not exists idx_subscriptions_org
  on subscriptions (org_id);

create index if not exists idx_subscriptions_stripe_sub
  on subscriptions (stripe_subscription_id)
  where stripe_subscription_id is not null;

create index if not exists idx_subscriptions_stripe_cust
  on subscriptions (stripe_customer_id)
  where stripe_customer_id is not null;

-- ---- subscriptions RLS ----
alter table subscriptions enable row level security;

create policy "Org members can view own subscription"
  on subscriptions for select
  to authenticated
  using (
    exists (
      select 1 from org_members
      where org_members.org_id = subscriptions.org_id
        and org_members.user_id = auth.uid()
    )
  );

-- =========================
-- 14b. SQL functions for subscription writes (RPC)
-- =========================

-- Upsert subscription from a checkout session completion.
-- Called immediately after purchase to propagate state.
create or replace function public.upsert_subscription_from_checkout(
  p_org_id                uuid,
  p_tier                  text,
  p_stripe_subscription_id text,
  p_stripe_customer_id    text,
  p_stripe_price_id       text default null
)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.subscriptions (
    org_id, tier, status, stripe_subscription_id, stripe_customer_id, stripe_price_id, updated_at
  ) values (
    p_org_id, p_tier, 'active', p_stripe_subscription_id, p_stripe_customer_id, p_stripe_price_id, now()
  )
  on conflict (org_id) do update set
    tier                   = excluded.tier,
    status                 = 'active',
    stripe_subscription_id = excluded.stripe_subscription_id,
    stripe_customer_id     = excluded.stripe_customer_id,
    stripe_price_id        = coalesce(excluded.stripe_price_id, public.subscriptions.stripe_price_id),
    cancel_at_period_end   = false,
    current_period_end     = null,
    updated_at             = now();
end;
$$;

-- Sync subscription from a Stripe subscription object (created/updated events).
create or replace function public.sync_subscription_from_stripe(
  p_org_id                uuid,
  p_tier                  text,
  p_status                text,
  p_stripe_subscription_id text,
  p_stripe_customer_id    text,
  p_stripe_price_id       text,
  p_cancel_at_period_end  boolean,
  p_current_period_end    timestamptz
)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.subscriptions (
    org_id, tier, status, stripe_subscription_id, stripe_customer_id, stripe_price_id,
    cancel_at_period_end, current_period_end, updated_at
  ) values (
    p_org_id, p_tier, p_status, p_stripe_subscription_id, p_stripe_customer_id, p_stripe_price_id,
    p_cancel_at_period_end, p_current_period_end, now()
  )
  on conflict (org_id) do update set
    tier                   = excluded.tier,
    status                 = excluded.status,
    stripe_subscription_id = excluded.stripe_subscription_id,
    stripe_customer_id     = excluded.stripe_customer_id,
    stripe_price_id        = excluded.stripe_price_id,
    cancel_at_period_end   = excluded.cancel_at_period_end,
    current_period_end     = excluded.current_period_end,
    updated_at             = now();
end;
$$;

-- Clear subscription on deletion (downgrade to free).
create or replace function public.clear_subscription(
  p_org_id uuid
)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  update public.subscriptions set
    tier                   = 'free',
    status                 = 'none',
    stripe_subscription_id = null,
    stripe_price_id        = null,
    cancel_at_period_end   = false,
    current_period_end     = null,
    updated_at             = now()
  where org_id = p_org_id;
end;
$$;

-- Manual tier/status update (admin operations).
create or replace function public.update_subscription_tier(
  p_org_id  uuid,
  p_tier    text
)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.subscriptions (org_id, tier, updated_at)
  values (p_org_id, p_tier, now())
  on conflict (org_id) do update set
    tier       = excluded.tier,
    updated_at = now();
end;
$$;

-- Update subscription status only (e.g., invoice.paid → active, invoice.payment_failed → past_due).
create or replace function public.update_subscription_status(
  p_org_id  uuid,
  p_status  text
)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  update public.subscriptions set
    status     = p_status,
    updated_at = now()
  where org_id = p_org_id;
end;
$$;

-- Link a Stripe customer ID to an org's subscription row.
create or replace function public.link_stripe_customer(
  p_org_id             uuid,
  p_stripe_customer_id text
)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.subscriptions (org_id, stripe_customer_id, updated_at)
  values (p_org_id, p_stripe_customer_id, now())
  on conflict (org_id) do update set
    stripe_customer_id = excluded.stripe_customer_id,
    updated_at         = now();
end;
$$;

-- =========================
-- 14c. Backfill existing organization subscription data
-- =========================

-- Migrate existing subscription data from organizations into subscriptions table.
-- Idempotent: uses ON CONFLICT to skip orgs already migrated.
insert into subscriptions (
  org_id, tier, status, stripe_subscription_id, stripe_customer_id, stripe_price_id,
  cancel_at_period_end, current_period_end, updated_at
)
select
  o.id,
  coalesce(o.subscription_tier, 'free'),
  coalesce(o.subscription_status, 'none'),
  o.stripe_subscription_id,
  o.stripe_customer_id,
  o.stripe_price_id,
  coalesce(o.cancel_at_period_end, false),
  o.current_period_end,
  now()
from organizations o
on conflict (org_id) do nothing;

-- =========================
-- 15. Marketing assets (org-scoped generated materials)
-- =========================
create table if not exists marketing_assets (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references organizations (id) on delete cascade,
  project_id        uuid references projects (id) on delete set null,
  created_by        uuid not null references auth.users (id) on delete cascade,
  template_id       text not null,
  title             text not null default '',
  headline          text not null default '',
  body              text not null default '',
  cta               text not null default '',
  source_image_url  text,
  generated_image_url text,
  status            text not null default 'draft'
                      check (status in ('draft', 'generating', 'ready', 'failed')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_marketing_assets_org
  on marketing_assets (org_id, created_at desc);

create index if not exists idx_marketing_assets_project
  on marketing_assets (project_id)
  where project_id is not null;

-- ---- marketing_assets RLS ----
alter table marketing_assets enable row level security;

-- Org members can view marketing assets in their orgs
create policy "Org members can view marketing assets"
  on marketing_assets for select
  to authenticated
  using (
    exists (
      select 1 from org_members
      where org_members.org_id = marketing_assets.org_id
        and org_members.user_id = auth.uid()
    )
  );

-- Org members can create marketing assets in their orgs
create policy "Org members can create marketing assets"
  on marketing_assets for insert
  to authenticated
  with check (
    auth.uid() = created_by
    and exists (
      select 1 from org_members
      where org_members.org_id = marketing_assets.org_id
        and org_members.user_id = auth.uid()
    )
  );

-- Creators, admins, and superadmins can update marketing assets
create policy "Creators and admins can update marketing assets"
  on marketing_assets for update
  to authenticated
  using (
    auth.uid() = created_by
    or exists (
      select 1 from org_members
      where org_members.org_id = marketing_assets.org_id
        and org_members.user_id = auth.uid()
        and org_members.role in ('superadmin', 'admin')
    )
  );

-- Creators, admins, and superadmins can delete marketing assets
create policy "Creators and admins can delete marketing assets"
  on marketing_assets for delete
  to authenticated
  using (
    auth.uid() = created_by
    or exists (
      select 1 from org_members
      where org_members.org_id = marketing_assets.org_id
        and org_members.user_id = auth.uid()
        and org_members.role in ('superadmin', 'admin')
    )
  );

-- Seed marketing permissions into the global permissions table
insert into permissions (id) values
  ('marketing:view'),
  ('marketing:create'),
  ('marketing:update'),
  ('marketing:delete')
on conflict (id) do nothing;

-- Grant marketing permissions to default roles
insert into role_permissions (org_role_id, permission_id)
select r.id, p.id
from org_roles r
cross join permissions p
where r.name = 'superadmin' and r.org_id is null
  and p.id in ('marketing:view', 'marketing:create', 'marketing:update', 'marketing:delete')
on conflict (org_role_id, permission_id) do nothing;

insert into role_permissions (org_role_id, permission_id)
select r.id, p.id
from org_roles r
cross join permissions p
where r.name = 'admin' and r.org_id is null
  and p.id in ('marketing:view', 'marketing:create', 'marketing:update', 'marketing:delete')
on conflict (org_role_id, permission_id) do nothing;

insert into role_permissions (org_role_id, permission_id)
select r.id, p.id
from org_roles r
cross join permissions p
where r.name = 'member' and r.org_id is null
  and p.id in ('marketing:view', 'marketing:create')
on conflict (org_role_id, permission_id) do nothing;

-- =========================
-- Address & phone columns on organizations
-- =========================
alter table organizations
  add column if not exists phone text,
  add column if not exists address_line1 text,
  add column if not exists address_line2 text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists zip_code text;

-- =========================
-- Address & phone columns on projects (estate sale location)
-- =========================
alter table projects
  add column if not exists phone text,
  add column if not exists address_line1 text,
  add column if not exists address_line2 text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists zip_code text;

-- =========================
-- Support tickets
-- =========================
create table if not exists support_tickets (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references organizations (id) on delete cascade,
  user_id           uuid not null references auth.users (id) on delete cascade,
  title             text not null,
  description       text not null,
  category          text not null default 'general'
                      check (category in ('billing', 'bug', 'feature', 'general')),
  priority          text not null default 'low'
                      check (priority in ('low', 'medium', 'high')),
  status            text not null default 'open'
                      check (status in ('open', 'in_progress', 'resolved', 'closed')),
  tier_at_creation  text not null default 'free'
                      check (tier_at_creation in ('free', 'pro', 'enterprise')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  resolved_at       timestamptz
);

create index if not exists idx_support_tickets_org on support_tickets (org_id);
create index if not exists idx_support_tickets_user on support_tickets (user_id);
create index if not exists idx_support_tickets_status on support_tickets (status);

-- Org ticket list: .eq('org_id', X).order('created_at desc')
create index if not exists idx_support_tickets_org_created
  on support_tickets (org_id, created_at desc);

-- Developer portal: .eq('status', X).order('created_at desc')
create index if not exists idx_support_tickets_status_created
  on support_tickets (status, created_at desc);

-- =========================
-- Ticket replies
-- =========================
create table if not exists ticket_replies (
  id          uuid primary key default gen_random_uuid(),
  ticket_id   uuid not null references support_tickets (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  is_admin    boolean not null default false,
  message     text not null,
  created_at  timestamptz not null default now()
);

create index if not exists idx_ticket_replies_ticket on ticket_replies (ticket_id);

-- ---- support_tickets RLS ----
alter table support_tickets enable row level security;

create policy "Users can view own org tickets"
  on support_tickets for select
  to authenticated
  using (
    exists (
      select 1 from org_members as my
      where my.org_id = support_tickets.org_id
        and my.user_id = auth.uid()
    )
  );

create policy "Users can create tickets for own org"
  on support_tickets for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from org_members as my
      where my.org_id = support_tickets.org_id
        and my.user_id = auth.uid()
    )
  );

create policy "Users can update own tickets"
  on support_tickets for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---- ticket_replies RLS ----
alter table ticket_replies enable row level security;

create policy "Users can view replies on own org tickets"
  on ticket_replies for select
  to authenticated
  using (
    exists (
      select 1 from support_tickets st
      join org_members my on my.org_id = st.org_id and my.user_id = auth.uid()
      where st.id = ticket_replies.ticket_id
    )
  );

create policy "Users can create replies on own org tickets"
  on ticket_replies for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from support_tickets st
      join org_members my on my.org_id = st.org_id and my.user_id = auth.uid()
      where st.id = ticket_replies.ticket_id
    )
  );

-- ---- Staff portal RLS policies ----
-- Staff (developers + support) can view all tickets (cross-org)
create policy "Staff can view all tickets"
  on support_tickets for select
  to authenticated
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.role in ('developer', 'support')
    )
  );

-- Staff can update any ticket (change status, priority)
create policy "Staff can update all tickets"
  on support_tickets for update
  to authenticated
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.role in ('developer', 'support')
    )
  )
  with check (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.role in ('developer', 'support')
    )
  );

-- Staff can view all ticket replies
create policy "Staff can view all replies"
  on ticket_replies for select
  to authenticated
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.role in ('developer', 'support')
    )
  );

-- Staff can create admin replies on any ticket
create policy "Staff can create admin replies"
  on ticket_replies for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and is_admin = true
    and exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.role in ('developer', 'support')
    )
  );

-- =========================
-- Contact form submissions (public / unauthenticated)
-- =========================
create table if not exists contact_submissions (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  email      text not null,
  category   text not null default 'general',
  message    text not null,
  processed  boolean not null default false,
  created_at timestamptz not null default now()
);

alter table contact_submissions enable row level security;

create policy "Allow anonymous inserts"
  on contact_submissions for insert
  to anon
  with check (true);
