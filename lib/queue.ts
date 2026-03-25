import 'server-only';
import { send } from '@vercel/queue';

/** Well-known topic names. Keep in sync with vercel.json experimentalTriggers. */
export const TOPICS = {
  STRIPE_WEBHOOK: 'stripe-webhook',
  PROCESS_IMAGE: 'process-image',
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
  // In local dev (no VERCEL env), process inline
  if (!process.env.VERCEL) {
    console.warn(`LOCAL: Vercel Queue not available (local dev), processing inline for topic "${topic}".`);
    await processInline(payload);
    return;
  }

  try {
    await send(topic, payload);
  } catch (err) {
    console.error(`Vercel Queue send failed for topic "${topic}":`, err);
    // Fallback to inline processing so we don't drop the event
    await processInline(payload);
  }
}
