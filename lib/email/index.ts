import 'server-only';

/**
 * Curator email composition library — public API.
 *
 * Consuming code should import from `@/lib/email` exclusively.
 * Internal modules (shared/, builders/) are implementation details.
 */

// ── Re-export types ──────────────────────────────────────────

export type {
  ClientPortalEmailBuilderInput,
  ClientPortalEmailRequest,
  ContractSentEmailBuilderInput,
  ContractSentEmailRequest,
  ContractSnapshot,
  EmailContent,
  EmailKind,
  EmailProvider,
  EmailProviderAdapter,
  EmailSendRequest,
  EmailSendResult,
  WelcomeEmailBuilderInput,
  WelcomeEmailRequest,
} from './types';

// ── Re-export builders ───────────────────────────────────────

export { buildWelcomeEmailContent } from './builders/welcome-email';
export { buildClientPortalEmailContent } from './builders/client-portal-email';
export { buildContractSentEmailContent } from './builders/contract-sent-email';

// ── Re-export adapter factory ────────────────────────────────

export {
  getEmailAdapter,
  createResendAdapter,
  createSendGridAdapter,
  createManualEmailAdapter,
} from '@/lib/onboarding-providers/email';
