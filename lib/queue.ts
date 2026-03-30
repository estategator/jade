import 'server-only';
import { send } from '@vercel/queue';

/** Well-known topic names. Keep in sync with vercel.json experimentalTriggers. */
export const TOPICS = {
  STRIPE_WEBHOOK: 'stripe-webhook',
  SQUARE_WEBHOOK: 'square-webhook',
  CLOVER_WEBHOOK: 'clover-webhook',
  PROCESS_IMAGE: 'process-image',
  ANALYZE_IMAGE: 'analyze-image',
  INVOICE_GENERATION: 'invoice-generation',
  CONTRACT_WEBHOOK: 'contract-webhook',
  WELCOME_EMAIL: 'welcome-email',
  CLIENT_PORTAL_EMAIL: 'client-portal-email',
  CONTRACT_SENT_EMAIL: 'contract-sent-email',
  WALKTHROUGH_WEBHOOK: 'walkthrough-webhook',
} as const;

/**
 * Publish a message to a Vercel Queue topic.
 *
 * In local dev (no VERCEL env) or when sending fails, falls back to
 * inline processing so events are never silently dropped.
 */
export async function enqueue<T>(
  topic: string,
  payload: T,
  processInline: (data: T) => Promise<void>,
): Promise<void> {
  // In local dev (no VERCEL env), process concurrently without awaiting
  // so that Promise.all batches of enqueue calls actually run in parallel.
  if (!process.env.VERCEL) {
    console.warn(`LOCAL: Vercel Queue not available (local dev), processing inline for topic "${topic}".`);
    processInline(payload).catch((err) =>
      console.error(`LOCAL inline processing failed for topic "${topic}":`, err),
    );
    return;
  }

  try {
    await send(topic, payload);
  } catch (err) {
    console.error(`Vercel Queue send failed for topic "${topic}":`, err);
    // Fallback: fire-and-forget so we don't block the caller
    processInline(payload).catch((fallbackErr) =>
      console.error(`Fallback inline processing failed for topic "${topic}":`, fallbackErr),
    );
  }
}
