import { escapeHtml } from '../shared/escape-html';
import {
  ctaButton,
  divider,
  emailFooter,
  emailShell,
  heading,
  metadataCard,
  paragraph,
  secondaryLink,
  type MetadataRow,
} from '../shared/layout';
import type { EmailContent, WelcomeEmailRequest } from '../types';

// ── Contract status labels ───────────────────────────────────

const CONTRACT_STATUS_LABELS: Record<string, string> = {
  draft: 'Contract drafted — awaiting review',
  sent: 'Contract sent — awaiting your signature',
  viewed: 'Contract viewed — awaiting your signature',
  signed: 'Contract signed — complete',
  declined: 'Contract declined',
  voided: 'Contract voided',
  expired: 'Contract expired',
};

// ── Builder ──────────────────────────────────────────────────

/**
 * Compose the welcome email for a newly onboarded client.
 *
 * Returns both a polished HTML body wrapped in the branded shell and a
 * plain-text equivalent that carries the same information.
 */
export function buildWelcomeEmailContent(request: WelcomeEmailRequest): EmailContent {
  // ── Plain text ─────────────────────────────────────────────
  const lines: string[] = [];
  lines.push(`Hi ${request.recipientName},`);
  lines.push('');
  lines.push(`Welcome to your project "${request.projectName}" with ${request.orgName}.`);
  lines.push('');

  if (request.textBody) {
    lines.push(request.textBody);
    lines.push('');
  }

  if (request.shareUrl) {
    lines.push('You can view your project details and progress at any time:');
    lines.push(request.shareUrl);
    lines.push('');
  }

  if (request.contract) {
    const statusLabel =
      CONTRACT_STATUS_LABELS[request.contract.status] ?? `Status: ${request.contract.status}`;
    lines.push(`Agreement: ${request.contract.templateName}`);
    lines.push(statusLabel);
    if (request.contract.signedAt) {
      lines.push(`Signed on: ${new Date(request.contract.signedAt).toLocaleDateString()}`);
    }
    lines.push('');
  }

  lines.push('Thank you,');
  lines.push(`The ${request.orgName} team`);

  // ── HTML ───────────────────────────────────────────────────
  const htmlParts: string[] = [];

  // Greeting + heading
  htmlParts.push(heading(`Welcome, ${escapeHtml(request.recipientName)}`));
  htmlParts.push(
    paragraph(
      `You&#39;re all set for <strong style="color:#1c1917;">${escapeHtml(request.projectName)}</strong> with <strong style="color:#1c1917;">${escapeHtml(request.orgName)}</strong>.`,
    ),
  );

  // User-supplied body
  if (request.textBody) {
    htmlParts.push(paragraph(escapeHtml(request.textBody).replace(/\n/g, '<br>')));
  }

  // CTA + link
  if (request.shareUrl) {
    htmlParts.push(
      paragraph('View your project details and track progress at any time:'),
    );
    htmlParts.push(ctaButton(request.shareUrl, 'View Your Project'));
    htmlParts.push(secondaryLink(request.shareUrl));
  }

  // Contract card
  if (request.contract) {
    htmlParts.push(divider());
    const statusLabel =
      CONTRACT_STATUS_LABELS[request.contract.status] ?? `Status: ${request.contract.status}`;
    const rows: MetadataRow[] = [
      { label: 'Agreement', value: request.contract.templateName },
      { label: 'Status', value: statusLabel },
    ];
    if (request.contract.signedAt) {
      rows.push({
        label: 'Signed',
        value: new Date(request.contract.signedAt).toLocaleDateString(),
      });
    }
    htmlParts.push(metadataCard(rows));
  }

  // Sign-off
  htmlParts.push(
    paragraph(
      `Thank you,<br><strong style="color:#1c1917;">The ${escapeHtml(request.orgName)} team</strong>`,
    ),
  );

  return {
    textBody: lines.join('\n'),
    htmlBody: emailShell(htmlParts.join('\n'), emailFooter(request.orgName)),
  };
}
