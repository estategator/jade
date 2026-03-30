import 'server-only';

/**
 * Email delivery abstraction for onboarding welcome messages.
 *
 * Provider-agnostic — onboarding actions call sendWelcomeEmail() and
 * the active adapter handles template rendering + delivery.
 */

// ── Types ────────────────────────────────────────────────────

export type EmailProvider = 'resend' | 'sendgrid' | 'manual';

export type ContractSnapshot = {
  status: string;
  templateName: string;
  provider: string;
  signedAt: string | null;
};

export type WelcomeEmailRequest = {
  /** Internal welcome_messages row ID — used for status callbacks. */
  welcomeMessageId: string;
  to: string;
  recipientName: string;
  subject: string;
  /** Plain-text body. */
  textBody: string;
  /** HTML body (optional — provider may use its own template). */
  htmlBody?: string;
  /** Org/project context for template rendering. */
  orgName: string;
  projectName: string;
  shareUrl?: string;
  /** Contract context (optional — included when a contract exists). */
  contract?: ContractSnapshot;
};

export type EmailSendResult = {
  /** Provider-assigned message ID. */
  externalMessageId: string | null;
  status: 'sent' | 'queued' | 'failed';
  error?: string;
};

// ── Adapter interface ────────────────────────────────────────

export interface EmailProviderAdapter {
  send(request: WelcomeEmailRequest): Promise<EmailSendResult>;
}

// ── Resend adapter ───────────────────────────────────────────

export function createResendAdapter(): EmailProviderAdapter {
  const apiKey = process.env.RESEND_API_KEY ?? '';
  const fromAddress = process.env.RESEND_FROM_ADDRESS ?? 'noreply@inventorytools.app';

  return {
    async send(request) {
      if (!apiKey) {
        throw new Error('Resend API key not configured. Set RESEND_API_KEY.');
      }

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromAddress,
          to: [request.to],
          subject: request.subject,
          html: request.htmlBody ?? `<p>${request.textBody.replace(/\n/g, '<br>')}</p>`,
          text: request.textBody,
          tags: [
            { name: 'welcome_message_id', value: request.welcomeMessageId },
            { name: 'type', value: 'welcome' },
          ],
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        return {
          externalMessageId: null,
          status: 'failed' as const,
          error: `Resend API error (${res.status}): ${text}`,
        };
      }

      const data = (await res.json()) as { id: string };
      return { externalMessageId: data.id, status: 'sent' };
    },
  };
}

// ── SendGrid adapter ─────────────────────────────────────────

export function createSendGridAdapter(): EmailProviderAdapter {
  const apiKey = process.env.SENDGRID_API_KEY ?? '';
  const fromAddress = process.env.SENDGRID_FROM_ADDRESS ?? 'noreply@inventorytools.app';

  return {
    async send(request) {
      if (!apiKey) {
        throw new Error('SendGrid API key not configured. Set SENDGRID_API_KEY.');
      }

      const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [
            {
              to: [{ email: request.to, name: request.recipientName }],
              custom_args: {
                welcome_message_id: request.welcomeMessageId,
              },
            },
          ],
          from: { email: fromAddress },
          subject: request.subject,
          content: [
            { type: 'text/plain', value: request.textBody },
            {
              type: 'text/html',
              value: request.htmlBody ?? `<p>${request.textBody.replace(/\n/g, '<br>')}</p>`,
            },
          ],
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        return {
          externalMessageId: null,
          status: 'failed' as const,
          error: `SendGrid API error (${res.status}): ${text}`,
        };
      }

      // SendGrid returns 202 with x-message-id header
      const messageId = res.headers.get('x-message-id');
      return { externalMessageId: messageId, status: 'sent' };
    },
  };
}

// ── Manual/no-op adapter ─────────────────────────────────────

export function createManualEmailAdapter(): EmailProviderAdapter {
  return {
    async send(request) {
      console.log(`[email-manual] Would send welcome to ${request.to}: "${request.subject}"`);
      return { externalMessageId: `manual_${request.welcomeMessageId}`, status: 'sent' };
    },
  };
}

// ── Email content builder ─────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const CONTRACT_STATUS_LABELS: Record<string, string> = {
  draft: 'Contract drafted — awaiting review',
  sent: 'Contract sent — awaiting your signature',
  viewed: 'Contract viewed — awaiting your signature',
  signed: 'Contract signed — complete',
  declined: 'Contract declined',
  voided: 'Contract voided',
  expired: 'Contract expired',
};

export function buildWelcomeEmailContent(request: WelcomeEmailRequest): {
  textBody: string;
  htmlBody: string;
} {
  const lines: string[] = [];
  const htmlParts: string[] = [];

  // Greeting
  lines.push(`Hi ${request.recipientName},`);
  lines.push('');
  htmlParts.push(`<p>Hi ${escapeHtml(request.recipientName)},</p>`);

  // Intro
  const intro = `Welcome to your project "${request.projectName}" with ${request.orgName}.`;
  lines.push(intro);
  lines.push('');
  htmlParts.push(`<p>${escapeHtml(intro)}</p>`);

  // User-supplied body (if provided)
  if (request.textBody) {
    lines.push(request.textBody);
    lines.push('');
    htmlParts.push(`<p>${escapeHtml(request.textBody).replace(/\n/g, '<br>')}</p>`);
  }

  // Public project link
  if (request.shareUrl) {
    lines.push('You can view your project details and progress at any time:');
    lines.push(request.shareUrl);
    lines.push('');
    htmlParts.push(
      `<p>You can view your project details and progress at any time:</p>` +
      `<p><a href="${escapeHtml(request.shareUrl)}" style="color:#4f46e5;text-decoration:underline;">${escapeHtml(request.shareUrl)}</a></p>`,
    );
  }

  // Contract section
  if (request.contract) {
    const statusLabel =
      CONTRACT_STATUS_LABELS[request.contract.status] ?? `Status: ${request.contract.status}`;
    lines.push(`Agreement: ${request.contract.templateName}`);
    lines.push(statusLabel);
    if (request.contract.signedAt) {
      lines.push(`Signed on: ${new Date(request.contract.signedAt).toLocaleDateString()}`);
    }
    lines.push('');
    htmlParts.push(
      `<table cellpadding="8" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;margin:12px 0;width:100%;max-width:480px;">` +
      `<tr><td style="font-weight:600;color:#111827;">Agreement</td><td>${escapeHtml(request.contract.templateName)}</td></tr>` +
      `<tr><td style="font-weight:600;color:#111827;">Status</td><td>${escapeHtml(statusLabel)}</td></tr>` +
      (request.contract.signedAt
        ? `<tr><td style="font-weight:600;color:#111827;">Signed</td><td>${new Date(request.contract.signedAt).toLocaleDateString()}</td></tr>`
        : '') +
      `</table>`,
    );
  }

  // Sign-off
  lines.push(`Thank you,`);
  lines.push(`The ${request.orgName} team`);
  htmlParts.push(`<p>Thank you,<br>The ${escapeHtml(request.orgName)} team</p>`);

  return {
    textBody: lines.join('\n'),
    htmlBody: htmlParts.join(''),
  };
}

/** Build email content specifically for the client portal link delivery. */
export function buildClientPortalEmailContent(request: {
  recipientName: string;
  orgName: string;
  projectName: string;
  shareUrl: string;
}): {
  textBody: string;
  htmlBody: string;
} {
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
    `Thank you,`,
    `The ${request.orgName} team`,
  ];

  const htmlParts = [
    `<p>Hi ${escapeHtml(request.recipientName)},</p>`,
    `<p>Your client portal for &ldquo;${escapeHtml(request.projectName)}&rdquo; with ${escapeHtml(request.orgName)} is ready.</p>`,
    `<p>You can view your project details, progress updates, and key documents at any time:</p>`,
    `<p style="margin:16px 0;"><a href="${escapeHtml(request.shareUrl)}" style="display:inline-block;padding:12px 24px;background-color:#4f46e5;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;">Open Client Portal</a></p>`,
    `<p style="font-size:13px;color:#6b7280;">Or copy this link: <a href="${escapeHtml(request.shareUrl)}" style="color:#4f46e5;text-decoration:underline;">${escapeHtml(request.shareUrl)}</a></p>`,
    `<p style="font-size:13px;color:#6b7280;">This link is private — please do not share it with others.</p>`,
    `<p>Thank you,<br>The ${escapeHtml(request.orgName)} team</p>`,
  ];

  return {
    textBody: textLines.join('\n'),
    htmlBody: htmlParts.join(''),
  };
}

// ── Factory ──────────────────────────────────────────────────

export function getEmailAdapter(provider?: EmailProvider): EmailProviderAdapter {
  const active = provider ?? (process.env.EMAIL_PROVIDER as EmailProvider | undefined) ?? 'manual';
  switch (active) {
    case 'resend':
      return createResendAdapter();
    case 'sendgrid':
      return createSendGridAdapter();
    case 'manual':
      return createManualEmailAdapter();
    default:
      throw new Error(`Unsupported email provider: ${active as string}`);
  }
}
