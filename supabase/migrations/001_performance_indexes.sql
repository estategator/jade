-- ============================================================
-- Performance Indexes Migration
-- Adds composite and partial indexes to cover hot query paths
-- identified from application server actions and RLS policies.
--
-- Run with CONCURRENTLY in production to avoid table locks.
-- In Supabase SQL Editor, remove CONCURRENTLY (not supported
-- inside transactions); run each CREATE INDEX statement
-- individually instead.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. inventory_items — project-scoped listings & status filters
-- ─────────────────────────────────────────────────────────────

-- getInventoryItems, getPublicProjectItems: .eq('project_id', X).order('created_at desc')
-- Currently NO index on project_id at all — biggest gap.
create index concurrently if not exists idx_inventory_items_project_created
  on inventory_items (project_id, created_at desc)
  where project_id is not null;

-- getRevenueByMonth: .eq('org_id', X).eq('status', 'sold')
-- getDashboardStats reads all items for an org then filters in JS;
-- this also speeds up the server-side sold-only query.
create index concurrently if not exists idx_inventory_items_org_status
  on inventory_items (org_id, status);

-- cleanup-images cron: .eq('processing_status', 'complete').lt('created_at', ...)
create index concurrently if not exists idx_inventory_items_processing_cleanup
  on inventory_items (processing_status, created_at)
  where processing_status = 'complete';

-- ─────────────────────────────────────────────────────────────
-- 2. organization_invitations — pending invite queues
-- ─────────────────────────────────────────────────────────────

-- getPendingInvitations: .eq('org_id', X).eq('status', 'pending').order('created_at desc')
-- inviteOrgMember: count pending per org
create index concurrently if not exists idx_org_invitations_org_pending
  on organization_invitations (org_id, created_at desc)
  where status = 'pending';

-- syncPendingInvitesForUser: .eq('email', X).eq('status', 'pending').is('invited_user_id', null)
create index concurrently if not exists idx_org_invitations_email_pending
  on organization_invitations (email)
  where status = 'pending' and invited_user_id is null;

-- ─────────────────────────────────────────────────────────────
-- 3. sales — dashboard & revenue queries
-- ─────────────────────────────────────────────────────────────

-- getRecentSales: .in('seller_org_id', X).order('created_at desc').limit(10)
create index concurrently if not exists idx_sales_org_created
  on sales (seller_org_id, created_at desc);

-- getSalesRevenue: .in('seller_org_id', X).eq('status', 'completed')
create index concurrently if not exists idx_sales_org_completed
  on sales (seller_org_id, amount)
  where status = 'completed';

-- ─────────────────────────────────────────────────────────────
-- 4. user_notifications — unresolved feed & unread count
-- ─────────────────────────────────────────────────────────────

-- getUnreadNotificationCount: .eq('recipient_user_id', X).is('resolved_at', null).is('read_at', null)
create index concurrently if not exists idx_user_notifications_unread
  on user_notifications (recipient_user_id, created_at desc)
  where resolved_at is null and read_at is null;

-- resolveNotificationsForSource: .eq('source_table', X).eq('source_id', X).is('resolved_at', null)
create index concurrently if not exists idx_user_notifications_source_unresolved
  on user_notifications (source_table, source_id)
  where resolved_at is null;

-- ─────────────────────────────────────────────────────────────
-- 5. support_tickets — org-scoped & status-filtered lists
-- ─────────────────────────────────────────────────────────────

-- getTickets: .eq('org_id', X).order('created_at desc').limit(50)
-- getMonthlyTicketCount: .eq('org_id', X).gte('created_at', ...)
create index concurrently if not exists idx_support_tickets_org_created
  on support_tickets (org_id, created_at desc);

-- developer getTickets: .eq('status', X).order('created_at desc')
create index concurrently if not exists idx_support_tickets_status_created
  on support_tickets (status, created_at desc);

-- ─────────────────────────────────────────────────────────────
-- 6. organizations — Stripe Connect webhook lookups
-- ─────────────────────────────────────────────────────────────

-- account.updated webhook: .update(...).eq('stripe_account_id', X)
create index concurrently if not exists idx_organizations_stripe_account
  on organizations (stripe_account_id)
  where stripe_account_id is not null;

-- ─────────────────────────────────────────────────────────────
-- 7. org_members — RLS policy acceleration
-- ─────────────────────────────────────────────────────────────

-- Many RLS policies: exists(select 1 from org_members where org_id=X and user_id=auth.uid() and role in ('superadmin','admin'))
-- The UNIQUE(org_id, user_id) index already satisfies the lookup, but adding role
-- lets Postgres satisfy the admin check as an index-only scan without a heap fetch.
create index concurrently if not exists idx_org_members_org_user_role
  on org_members (org_id, user_id, role);

-- ─────────────────────────────────────────────────────────────
-- 8. marketing_assets — status-filtered listings
-- ─────────────────────────────────────────────────────────────

-- getMarketingAssets: .eq('org_id', X).order('created_at desc') — already covered
-- generateMarketingContent: .update(...).eq('id', X) — PK
-- Only add if status filtering becomes common in the UI:
-- create index concurrently if not exists idx_marketing_assets_org_status
--   on marketing_assets (org_id, status, created_at desc);

-- ─────────────────────────────────────────────────────────────
-- Rollback (run if you need to revert)
-- ─────────────────────────────────────────────────────────────
-- drop index concurrently if exists idx_inventory_items_project_created;
-- drop index concurrently if exists idx_inventory_items_org_status;
-- drop index concurrently if exists idx_inventory_items_processing_cleanup;
-- drop index concurrently if exists idx_org_invitations_org_pending;
-- drop index concurrently if exists idx_org_invitations_email_pending;
-- drop index concurrently if exists idx_sales_org_created;
-- drop index concurrently if exists idx_sales_org_completed;
-- drop index concurrently if exists idx_user_notifications_unread;
-- drop index concurrently if exists idx_user_notifications_source_unresolved;
-- drop index concurrently if exists idx_support_tickets_org_created;
-- drop index concurrently if exists idx_support_tickets_status_created;
-- drop index concurrently if exists idx_organizations_stripe_account;
-- drop index concurrently if exists idx_org_members_org_user_role;
