import 'server-only';

/**
 * Email delivery abstraction for onboarding welcome messages.
 *
 * Provider-agnostic — onboarding actions call sendWelcomeEmail() and
 * the active adapter handles template rendering + delivery.
 */

// ── Types ────────────────────────────────────────────────────

export type EmailProvider = 'resend' | 'sendgrid' | 'manual';

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
  const fromAddress = process.env.RESEND_FROM_ADDRESS ?? 'noreply@estategator.com';

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
  const fromAddress = process.env.SENDGRID_FROM_ADDRESS ?? 'noreply@estategator.com';

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
