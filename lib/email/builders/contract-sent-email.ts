import { escapeHtml } from '../shared/escape-html';
import {
  ctaButton,
  divider,
  emailFooter,
  emailShell,
  heading,
  metadataCard,
  paragraph,
  type MetadataRow,
} from '../shared/layout';
import type { ContractSentEmailBuilderInput, EmailContent } from '../types';

// ── Builder ──────────────────────────────────────────────────

/**
 * Compose the "contract sent" notification email.
 *
 * Sent automatically when an estate-sale agreement is dispatched to a
 * client via DocuSign / Dropbox Sign / manual provider.
 */
export function buildContractSentEmailContent(
  request: ContractSentEmailBuilderInput,
): EmailContent {
  // ── Plain text ─────────────────────────────────────────────
  const lines: string[] = [];
  lines.push(`Hi ${request.recipientName},`);
  lines.push('');
  lines.push(
    `An agreement for your project "${request.projectName}" with ${request.orgName} has been sent for your signature.`,
  );
  lines.push('');
  lines.push(`Agreement: ${request.contractName}`);
  lines.push(`Sent via: ${request.provider}`);
  lines.push('');

  if (request.signingUrl) {
    lines.push('You can review and sign the agreement here:');
    lines.push(request.signingUrl);
    lines.push('');
  } else {
    lines.push(
      'Please check your email for a signing link from the e-signature provider.',
    );
    lines.push('');
  }

  lines.push('Thank you,');
  lines.push(`The ${request.orgName} team`);

  // ── HTML ───────────────────────────────────────────────────
  const htmlParts: string[] = [];

  htmlParts.push(heading('Agreement Sent'));
  htmlParts.push(
    paragraph(
      `Hi ${escapeHtml(request.recipientName)}, an agreement for <strong style="color:#1c1917;">${escapeHtml(request.projectName)}</strong> with <strong style="color:#1c1917;">${escapeHtml(request.orgName)}</strong> has been sent for your signature.`,
    ),
  );

  htmlParts.push(divider());

  const rows: MetadataRow[] = [
    { label: 'Agreement', value: request.contractName },
    { label: 'Sent via', value: request.provider },
  ];
  htmlParts.push(metadataCard(rows));

  if (request.signingUrl) {
    htmlParts.push(ctaButton(request.signingUrl, 'Review & Sign'));
  } else {
    htmlParts.push(
      paragraph(
        'Please check your email for a signing link from the e-signature provider.',
        true,
      ),
    );
  }

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
