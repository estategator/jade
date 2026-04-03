// ── Types ────────────────────────────────────────────────────

export type DocusealSigningEmailInput = {
  recipientName: string;
  orgName: string;
  projectName: string;
  documentTitle: string;
};

// ── Builder ──────────────────────────────────────────────────

/**
 * Build the email message for a Docuseal signing request.
 *
 * IMPORTANT: Docuseal renders `message.body` as **plain text** inside
 * its own branded email template. HTML tags are stripped. Use only
 * plain text with `{{submitter.link}}` on its own line — Docuseal
 * auto-links it.
 *
 * Supported template variables:
 *   - `{{submitter.link}}` — unique signing URL for the recipient
 *   - `{{template.name}}` — name of the Docuseal template
 *   - `{{account.name}}`  — Docuseal account name
 */
export function buildDocusealSigningEmail(
  input: DocusealSigningEmailInput,
): { subject: string; body: string } {
  const { recipientName, orgName, projectName, documentTitle } = input;

  const subject = `${orgName}: Please sign "${documentTitle}" for ${projectName}`;

  // Plain text body — Docuseal wraps this in its own styled email.
  // {{submitter.link}} is replaced with the actual signing URL and auto-linked.
  const body = [
    `Hi ${recipientName},`,
    ``,
    `${orgName} has prepared an agreement for your project "${projectName}" and it's ready for your review and signature.`,
    ``,
    `Agreement: ${documentTitle}`,
    `Project: ${projectName}`,
    `Prepared by: ${orgName}`,
    ``,
    `Please review and sign using the link below:`,
    `{{submitter.link}}`,
    ``,
    `If you have any questions, reply to this email or contact the ${orgName} team directly.`,
    ``,
    `Thank you,`,
    `The ${orgName} team`,
  ].join('\n');

  return { subject, body };
}
