import 'server-only';

/**
 * Shared types for the email composition library.
 *
 * Each email flow (welcome, client-portal, contract-sent) has its own
 * request type with a `kind` discriminator so provider adapters can
 * tag and process each flow independently.
 */

// ── Provider ─────────────────────────────────────────────────

export type EmailProvider = 'resend' | 'sendgrid' | 'manual';

// ── Email kind discriminator ─────────────────────────────────

export type EmailKind = 'welcome' | 'client_portal' | 'contract_sent';

// ── Contract snapshot ────────────────────────────────────────

export type ContractSnapshot = {
  status: string;
  templateName: string;
  provider: string;
  signedAt: string | null;
};

// ── Base fields shared by all email requests ─────────────────

type EmailRequestBase = {
  /** Unique row ID for status callbacks (welcome_messages.id or contracts.id). */
  messageId: string;
  to: string;
  recipientName: string;
  subject: string;
  /** Pre-composed plain-text body. */
  textBody: string;
  /** Pre-composed HTML body (optional — provider may use its own template). */
  htmlBody?: string;
  orgName: string;
  projectName: string;
};

// ── Per-flow request types ───────────────────────────────────

export type WelcomeEmailRequest = EmailRequestBase & {
  kind: 'welcome';
};

export type ClientPortalEmailRequest = EmailRequestBase & {
  kind: 'client_portal';
  shareUrl: string;
};

export type ContractSentEmailRequest = EmailRequestBase & {
  kind: 'contract_sent';
  contractName: string;
  contractProvider: string;
  signingUrl?: string;
};

/** Discriminated union accepted by provider adapters. */
export type EmailSendRequest =
  | WelcomeEmailRequest
  | ClientPortalEmailRequest
  | ContractSentEmailRequest;

// ── Result ───────────────────────────────────────────────────

export type EmailSendResult = {
  /** Provider-assigned message ID. */
  externalMessageId: string | null;
  status: 'sent' | 'queued' | 'failed';
  error?: string;
};

// ── Adapter interface ────────────────────────────────────────

export interface EmailProviderAdapter {
  send(request: EmailSendRequest): Promise<EmailSendResult>;
}

// ── Builder input types (used by builder modules only) ───────

export type WelcomeEmailBuilderInput = {
  recipientName: string;
  orgName: string;
  projectName: string;
  textBody: string;
};

export type ClientPortalEmailBuilderInput = {
  recipientName: string;
  orgName: string;
  projectName: string;
  shareUrl: string;
};

export type ContractSentEmailBuilderInput = {
  recipientName: string;
  orgName: string;
  projectName: string;
  contractName: string;
  provider: string;
  signingUrl?: string;
};

// ── Builder output ───────────────────────────────────────────

export type EmailContent = {
  textBody: string;
  htmlBody: string;
};
