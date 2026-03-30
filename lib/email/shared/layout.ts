import { escapeHtml } from './escape-html';

/**
 * Email-safe design tokens derived from the Curator style-maintainer palette.
 *
 * All values are inline-style-friendly hex colours that render consistently
 * across Gmail, Outlook, Apple Mail, and mobile clients.
 */
export const COLORS = {
  /** indigo-600 — primary CTA background and link colour */
  brand: '#4f46e5',
  /** indigo-700 — hover hint (some clients honour it) */
  brandDark: '#4338ca',
  /** stone-900 — primary heading / label text */
  text: '#1c1917',
  /** stone-600 — body / secondary text */
  textSecondary: '#57534e',
  /** stone-500 — muted captions */
  textMuted: '#78716c',
  /** white — card / container background */
  surface: '#ffffff',
  /** stone-50 — page / outer background */
  pageBg: '#fafaf9',
  /** stone-200 — borders, dividers */
  border: '#e7e5e4',
  /** stone-100 — subtle row stripe */
  stripe: '#f5f5f4',
  /** emerald-600 — success accent */
  success: '#059669',
  /** red-600 — error accent */
  error: '#dc2626',
} as const;

const FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji'";

// ── Layout wrapper ───────────────────────────────────────────

/**
 * Wraps email body content in a branded, centered card layout.
 *
 * Structure: full-width page bg → centred card → content → footer.
 */
export function emailShell(bodyHtml: string, footerHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title></title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:${COLORS.pageBg};font-family:${FONT_STACK};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${COLORS.pageBg};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <!-- Card -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background-color:${COLORS.surface};border-radius:12px;border:1px solid ${COLORS.border};overflow:hidden;">
          <!-- Brand bar -->
          <tr>
            <td style="background:linear-gradient(135deg,${COLORS.brand},#7c3aed);height:6px;font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:36px 32px 28px 32px;">
              ${bodyHtml}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;border-top:1px solid ${COLORS.border};background-color:${COLORS.pageBg};">
              ${footerHtml}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ── CTA button ───────────────────────────────────────────────

export function ctaButton(href: string, label: string): string {
  const safeHref = escapeHtml(href);
  const safeLabel = escapeHtml(label);
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
  <tr>
    <td align="center" style="background-color:${COLORS.brand};border-radius:8px;">
      <!--[if mso]>
      <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${safeHref}" style="height:48px;v-text-anchor:middle;width:220px;" arcsize="17%" fillcolor="${COLORS.brand}">
        <w:anchorlock/>
        <center style="color:#ffffff;font-family:${FONT_STACK};font-size:16px;font-weight:600;">${safeLabel}</center>
      </v:roundrect>
      <![endif]-->
      <!--[if !mso]><!-->
      <a href="${safeHref}" target="_blank" style="display:inline-block;padding:14px 32px;background-color:${COLORS.brand};color:#ffffff;text-decoration:none;border-radius:8px;font-size:16px;font-weight:600;font-family:${FONT_STACK};line-height:1;letter-spacing:0.01em;">${safeLabel}</a>
      <!--<![endif]-->
    </td>
  </tr>
</table>`;
}

// ── Secondary link ───────────────────────────────────────────

export function secondaryLink(href: string): string {
  const safeHref = escapeHtml(href);
  return `<p style="margin:0 0 8px;font-size:13px;color:${COLORS.textMuted};line-height:1.5;">
  Or copy this link: <a href="${safeHref}" style="color:${COLORS.brand};text-decoration:underline;word-break:break-all;">${safeHref}</a>
</p>`;
}

// ── Heading ──────────────────────────────────────────────────

export function heading(text: string): string {
  return `<h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:${COLORS.text};line-height:1.3;">${escapeHtml(text)}</h1>`;
}

// ── Paragraph ────────────────────────────────────────────────

export function paragraph(html: string, muted = false): string {
  const color = muted ? COLORS.textMuted : COLORS.textSecondary;
  return `<p style="margin:0 0 16px;font-size:15px;color:${color};line-height:1.6;">${html}</p>`;
}

// ── Divider ──────────────────────────────────────────────────

export function divider(): string {
  return `<hr style="border:none;border-top:1px solid ${COLORS.border};margin:24px 0;" />`;
}

// ── Key-value metadata card ──────────────────────────────────

export type MetadataRow = { label: string; value: string };

export function metadataCard(rows: MetadataRow[]): string {
  const rowsHtml = rows
    .map(
      (r, i) =>
        `<tr>
    <td style="padding:10px 14px;font-size:13px;font-weight:600;color:${COLORS.text};border-bottom:1px solid ${COLORS.border};width:35%;${i % 2 === 1 ? `background-color:${COLORS.stripe};` : ''}">${escapeHtml(r.label)}</td>
    <td style="padding:10px 14px;font-size:14px;color:${COLORS.textSecondary};border-bottom:1px solid ${COLORS.border};${i % 2 === 1 ? `background-color:${COLORS.stripe};` : ''}">${escapeHtml(r.value)}</td>
  </tr>`,
    )
    .join('\n');

  return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:440px;border:1px solid ${COLORS.border};border-radius:8px;border-collapse:separate;overflow:hidden;margin:16px 0;">
  ${rowsHtml}
</table>`;
}

// ── Footer ───────────────────────────────────────────────────

export function emailFooter(orgName: string): string {
  return `<p style="margin:0;font-size:12px;color:${COLORS.textMuted};line-height:1.5;">
  Sent by ${escapeHtml(orgName)} via <span style="color:${COLORS.brand};font-weight:600;">Curator</span><br>
  This is a transactional email related to your project.
</p>`;
}
