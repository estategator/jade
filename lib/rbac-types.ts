// Shared RBAC types — safe to import from both server and client components.

export type Permission =
  | 'org:update'
  | 'org:delete'
  | 'billing:manage'
  | 'members:invite'
  | 'members:remove'
  | 'members:update_role'
  | 'members:view'
  | 'projects:create'
  | 'projects:update'
  | 'projects:delete'
  | 'projects:view'
  | 'inventory:create'
  | 'inventory:update'
  | 'inventory:delete'
  | 'inventory:view'
  | 'settings:manage'
  | 'settings:view'
  | 'analytics:view'
  | 'sales:view';

export type OrgRole = 'superadmin' | 'admin' | 'member';

export type MemberStatus = 'active' | 'suspended';

export type AuditAction =
  | 'org.created'
  | 'org.updated'
  | 'org.deleted'
  | 'member.invited'
  | 'member.removed'
  | 'member.role_changed'
  | 'member.status_changed'
  | 'project.created'
  | 'project.updated'
  | 'project.deleted'
  | 'settings.updated'
  | 'billing.subscription_changed'
  | 'billing.stripe_connected'
  | 'inventory.created'
  | 'inventory.updated'
  | 'inventory.deleted';
