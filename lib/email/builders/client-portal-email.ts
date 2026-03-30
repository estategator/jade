import { escapeHtml } from '../shared/escape-html';
import {
  ctaButton,
  emailFooter,
  emailShell,
  heading,
  paragraph,
  secondaryLink,
} from '../shared/layout';
import type { ClientPortalEmailRequest, EmailContent } from '../types';

/**
 * Compose the client portal link email.
 *
 * Returns both a polished HTML body wrapped in the branded shell and a
 * plain-text equivalent that carries the same information.
 */
export function buildClientPortalEmailContent(
  request: ClientPortalEmailRequest,
): EmailContent {
  // ── Plain text ─────────────────────────────────────────────
  const textLines = [
    `Hi ${request.recipientName},`,
    '',
    `Your client portal for "${request.projectName}" with ${request.orgName} is ready.`,
    '',
    'You can view your project details, progress updates, and key documents at any time:',
    request.shareUrl,
    '',
    'This link is private — please do not share it with others.',
    '',
    'Thank you,',
    `The ${request.orgName} team`,
  ];

  // ── HTML ───────────────────────────────────────────────────
  const htmlParts: string[] = [];

  htmlParts.push(heading('Your Client Portal is Ready'));
  htmlParts.push(
    paragraph(
      `Hi ${escapeHtml(request.recipientName)}, your portal for <strong style="color:#1c1917;">${escapeHtml(request.projectName)}</strong> with <strong style="color:#1c1917;">${escapeHtml(request.orgName)}</strong> is ready.`,
    ),
  );
  htmlParts.push(
    paragraph('Access your project details, progress updates, and key documents at any time:'),
  );
  htmlParts.push(ctaButton(request.shareUrl, 'Open Client Portal'));
  htmlParts.push(secondaryLink(request.shareUrl));
  htmlParts.push(
    paragraph('This link is private &mdash; please do not share it with others.', true),
  );
  htmlParts.push(
    paragraph(
      `Thank you,<br><strong style="color:#1c1917;">The ${escapeHtml(request.orgName)} team</strong>`,
    ),
  );

  return {
    textBody: textLines.join('\n'),
    htmlBody: emailShell(htmlParts.join('\n'), emailFooter(request.orgName)),
  };
}
