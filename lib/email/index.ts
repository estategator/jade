import 'server-only';

/**
 * Curator email composition library — public API.
 *
 * Consuming code should import from `@/lib/email` exclusively.
 * Internal modules (shared/, builders/) are implementation details.
 */

// ── Re-export types ──────────────────────────────────────────

export type {
  ClientPortalEmailRequest,
  ContractSnapshot,
  EmailContent,
  EmailProvider,
  EmailProviderAdapter,
  EmailSendResult,
  WelcomeEmailRequest,
} from './types';

// ── Re-export builders ───────────────────────────────────────

export { buildWelcomeEmailContent } from './builders/welcome-email';
export { buildClientPortalEmailContent } from './builders/client-portal-email';
export { buildContractSentEmailContent } from './builders/contract-sent-email';
export type { ContractSentEmailRequest } from './builders/contract-sent-email';

// ── Re-export adapter factory ────────────────────────────────
// Adapters stay in the original file for now — avoids touching
// provider-specific fetch logic in this change.  The factory is
// re-exported so consuming code only needs one import source.

export {
  getEmailAdapter,
  createResendAdapter,
  createSendGridAdapter,
  createManualEmailAdapter,
} from '@/lib/onboarding-providers/email';
