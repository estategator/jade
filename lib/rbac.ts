import 'server-only';

import { supabaseAdmin } from '@/lib/supabase-admin';
import { createClient } from '@/utils/supabase/server';

export type { Permission, OrgRole, AuditAction, MemberStatus } from '@/lib/rbac-types';
import type { Permission, OrgRole, AuditAction, MemberStatus } from '@/lib/rbac-types';

// ── Default role → permission mapping (code-level, fast path) ─

const DEFAULT_ROLE_PERMISSIONS: Record<OrgRole, readonly Permission[]> = {
  superadmin: [
    'org:update', 'org:delete', 'billing:manage',
    'onboarding:view', 'onboarding:create', 'onboarding:update', 'onboarding:delete', 'onboarding:share',
    'members:invite', 'members:remove', 'members:update_role', 'members:view',
    'projects:create', 'projects:update', 'projects:delete', 'projects:view',
    'inventory:create', 'inventory:update', 'inventory:delete', 'inventory:view',
    'settings:manage', 'settings:view',
    'analytics:view', 'sales:view',
    'marketing:view', 'marketing:create', 'marketing:update', 'marketing:delete',
    'invoices:view', 'invoices:create', 'invoices:update', 'invoices:delete',
  ],
  admin: [
    'org:update',
    'onboarding:view', 'onboarding:create', 'onboarding:update', 'onboarding:delete', 'onboarding:share',
    'members:invite', 'members:remove', 'members:update_role', 'members:view',
    'projects:create', 'projects:update', 'projects:delete', 'projects:view',
    'inventory:create', 'inventory:update', 'inventory:delete', 'inventory:view',
    'settings:manage', 'settings:view',
    'analytics:view', 'sales:view',
    'marketing:view', 'marketing:create', 'marketing:update', 'marketing:delete',
    'invoices:view', 'invoices:create', 'invoices:update', 'invoices:delete',
  ],
  member: [
    'onboarding:view',
    'members:view',
    'projects:view',
    'inventory:create', 'inventory:update', 'inventory:delete', 'inventory:view',
    'settings:view',
    'analytics:view', 'sales:view',
    'marketing:view', 'marketing:create',
    'invoices:view', 'invoices:create',
  ],
} as const;

// ── Core helpers ─────────────────────────────────────────────

/**
 * Get the authenticated user ID from the session cookie.
 * Returns null when not logged in.
 */
export async function getSessionUserId(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/**
 * Read active org ID from the request cookies (server-side).
 */
export async function getActiveOrgIdServer(): Promise<string | null> {
  const { cookies } = await import('next/headers');
  const cookieStore = await cookies();
  return cookieStore.get('curator_active_org')?.value ?? null;
}

/**
 * Resolve a valid active org for the user.
 * 1. If the cookie value is set and the user is an active member → use it.
 * 2. Otherwise fall back to the user's first org membership.
 * Returns null only when the user truly has zero organizations.
 */
export async function resolveActiveOrgId(userId: string): Promise<string | null> {
  const cookieOrgId = await getActiveOrgIdServer();

  if (cookieOrgId) {
    // Validate membership
    const role = await getOrgRole(cookieOrgId, userId);
    if (role) return cookieOrgId;
  }

  // Cookie missing or stale — fall back to first org
  const { data } = await supabaseAdmin
    .from('org_members')
    .select('org_id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .limit(1);

  return data?.[0]?.org_id ?? null;
}

/**
 * Resolve the user's role in an org. Returns null if the user is not a member.
 */
export async function getOrgRole(
  orgId: string,
  userId: string
): Promise<OrgRole | null> {
  const { data, error } = await supabaseAdmin
    .from('org_members')
    .select('role, status')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .single();

  if (error || !data) return null;
  // Suspended members are treated as non-members for permission purposes
  if ((data.status as MemberStatus) === 'suspended') return null;
  return data.role as OrgRole;
}

/**
 * Verify the user is a member of the given org (server-side enforcement).
 * Returns their role on success, or an error payload.
 */
export async function requireOrgMembership(
  orgId: string,
  userId: string
): Promise<{ role: OrgRole } | { error: string }> {
  if (!orgId || !userId) {
    return { error: 'Missing organization or user context.' };
  }

  const role = await getOrgRole(orgId, userId);
  if (!role) {
    return { error: 'You are not a member of this organization.' };
  }
  return { role };
}

// ── Permission resolution ────────────────────────────────────

/**
 * Get the full set of permissions the user has in a given org.
 * Uses the default role → permission mapping (fast code path).
 * For orgs with custom role definitions, falls back to the DB.
 */
export async function getUserPermissions(
  orgId: string,
  userId: string
): Promise<Permission[]> {
  const role = await getOrgRole(orgId, userId);
  if (!role) return [];

  // Check if org has custom role overrides in the DB
  const { data: customRole } = await supabaseAdmin
    .from('org_roles')
    .select('id')
    .eq('org_id', orgId)
    .eq('name', role)
    .maybeSingle();

  if (customRole) {
    // Org has a custom definition for this role — resolve from DB
    const { data: perms } = await supabaseAdmin
      .from('role_permissions')
      .select('permission_id')
      .eq('org_role_id', customRole.id);

    return (perms ?? []).map((p) => p.permission_id as Permission);
  }

  // Default mapping (no DB round-trip for permissions)
  return [...DEFAULT_ROLE_PERMISSIONS[role]];
}

/**
 * Check whether the user has a specific permission in the org.
 */
export async function hasPermission(
  orgId: string,
  userId: string,
  permission: Permission
): Promise<boolean> {
  const perms = await getUserPermissions(orgId, userId);
  return perms.includes(permission);
}

/**
 * Enforce a permission. Returns `{ granted: true }` or an action-safe error.
 * Use this as the first call in any server action / route handler.
 */
export async function requirePermission(
  orgId: string,
  userId: string,
  permission: Permission
): Promise<{ granted: true } | { granted: false; error: string }> {
  if (!orgId || !userId) {
    return { granted: false, error: 'Missing organization or user context.' };
  }

  const allowed = await hasPermission(orgId, userId, permission);
  if (!allowed) {
    return { granted: false, error: 'You do not have permission to perform this action.' };
  }
  return { granted: true };
}

/**
 * Enforce multiple permissions (all must be granted).
 */
export async function requireAllPermissions(
  orgId: string,
  userId: string,
  permissions: Permission[]
): Promise<{ granted: true } | { granted: false; error: string }> {
  const userPerms = await getUserPermissions(orgId, userId);
  const missing = permissions.filter((p) => !userPerms.includes(p));
  if (missing.length > 0) {
    return { granted: false, error: 'You do not have permission to perform this action.' };
  }
  return { granted: true };
}

// ── Audit logging ────────────────────────────────────────────

/**
 * Write an audit log entry. Fire-and-forget — errors are logged but never
 * surface to the caller.
 */
export async function auditLog(params: {
  orgId: string | null;
  actorId: string;
  action: AuditAction;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await supabaseAdmin.from('audit_log').insert({
      org_id: params.orgId,
      actor_id: params.actorId,
      action: params.action,
      target_type: params.targetType ?? null,
      target_id: params.targetId ?? null,
      metadata: params.metadata ?? {},
    });
  } catch (err) {
    console.error('Audit log write failed:', err);
  }
}
