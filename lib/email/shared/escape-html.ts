/**
 * Centralised HTML escaping for email template content.
 *
 * Every user-derived or DB-derived string rendered into HTML email
 * bodies MUST pass through this function to prevent XSS.
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
