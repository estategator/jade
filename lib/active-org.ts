const COOKIE_NAME = 'curator_active_org';
const MAX_AGE = 60 * 60 * 24 * 365; // 1 year

/** Read active org ID from cookie (client-side only). */
export function getActiveOrgId(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`)
  );
  return match ? decodeURIComponent(match[1]) : null;
}

/** Set active org ID in cookie (client-side). */
export function setActiveOrgId(orgId: string): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(orgId)}; path=/; max-age=${MAX_AGE}; SameSite=Lax`;
}

/** Clear active org cookie (client-side). */
export function clearActiveOrgId(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
}

/** Cookie name exported for server-side readers (lib/rbac.ts). */
export const ACTIVE_ORG_COOKIE = COOKIE_NAME;
