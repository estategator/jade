import 'server-only';

/**
 * Shared types for the email composition library.
 *
 * These types mirror the contracts established in the original
 * onboarding-providers/email module and must remain stable.
 */

// ── Provider ─────────────────────────────────────────────────

export type EmailProvider = 'resend' | 'sendgrid' | 'manual';

// ── Contract snapshot ────────────────────────────────────────

export type ContractSnapshot = {
  status: string;
  templateName: string;
  provider: string;
  signedAt: string | null;
};

// ── Request / result ─────────────────────────────────────────

export type WelcomeEmailRequest = {
  /** Internal welcome_messages row ID — used for status callbacks. */
  welcomeMessageId: string;
  to: string;
  recipientName: string;
  subject: string;
  /** Plain-text body (user-supplied message). */
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

export type ClientPortalEmailRequest = {
  recipientName: string;
  orgName: string;
  projectName: string;
  shareUrl: string;
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

// ── Builder output ───────────────────────────────────────────

export type EmailContent = {
  textBody: string;
  htmlBody: string;
};
