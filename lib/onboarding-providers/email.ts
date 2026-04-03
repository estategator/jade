import 'server-only';

import type {
  EmailKind,
  EmailProviderAdapter,
  EmailSendRequest,
  EmailSendResult,
} from '@/lib/email/types';

/**
 * Email delivery abstraction for all onboarding email flows.
 *
 * Provider-agnostic — processors call adapter.send() with a
 * discriminated EmailSendRequest and the adapter handles delivery.
 */

// ── Re-export types consumers may need ───────────────────────

export type { EmailProviderAdapter, EmailSendRequest, EmailSendResult };

// ── Tag helpers ──────────────────────────────────────────────

function emailKindTag(kind: EmailKind): string {
  return kind; // 'welcome' | 'client_portal' | 'contract_sent'
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
            { name: 'message_id', value: request.messageId },
            { name: 'type', value: emailKindTag(request.kind) },
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
                message_id: request.messageId,
                email_type: emailKindTag(request.kind),
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

      const messageId = res.headers.get('x-message-id');
      return { externalMessageId: messageId, status: 'sent' };
    },
  };
}

// ── Manual/no-op adapter ─────────────────────────────────────

export function createManualEmailAdapter(): EmailProviderAdapter {
  return {
    async send(request) {
      console.log(`[email-manual] Would send ${request.kind} to ${request.to}: "${request.subject}"`);
      return { externalMessageId: `manual_${request.messageId}`, status: 'sent' };
    },
  };
}

// ── Adapter factory ──────────────────────────────────────────

export function getEmailAdapter(): EmailProviderAdapter {
  const provider = (process.env.EMAIL_PROVIDER as string) ?? 'manual';
  switch (provider) {
    case 'resend':
      return createResendAdapter();
    case 'sendgrid':
      return createSendGridAdapter();
    default:
      return createManualEmailAdapter();
  }
}

// ── (end of module) ──
