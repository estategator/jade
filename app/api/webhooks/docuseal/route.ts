import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookSignature } from '@/lib/docuseal';
import { enqueue, TOPICS } from '@/lib/queue';
import {
  processContractWebhook,
  type ContractWebhookPayload,
} from '@/lib/onboarding-webhook-processors';
import {
  getDocusealWebhookUrl,
  printDocusealWebhookSetup,
} from '@/lib/docuseal-webhook-config';

/**
 * Dedicated Docuseal webhook handler.
 *
 * Configure in the Docuseal console:
 *   URL → getDocusealWebhookUrl() (printed at startup)
 *
 * Accepts form.viewed, form.started, form.completed, form.declined events.
 */
export async function POST(req: NextRequest) {
  const receivedAt = Date.now();
  const body = await req.text();

  const sig =
    req.headers.get('x-docuseal-signature') ??
    req.headers.get('X-Docuseal-Signature') ??
    '';

  console.log('[docuseal-webhook] Incoming request', {
    timestamp: new Date(receivedAt).toISOString(),
    bodySize: body.length,
    hasSignature: !!sig,
    url: getDocusealWebhookUrl(),
  });

  // If the webhook secret is configured, verify the signature.
  // In development without a secret we skip verification to ease local testing.
  const secret = process.env.DOCUSEAL_WEBHOOK_SECRET ?? '';
  if (secret) {
    if (!verifyWebhookSignature(body, sig)) {
      console.error('[docuseal-webhook] Rejected: invalid signature');
      return NextResponse.json({ error: 'Invalid signature.' }, { status: 401 });
    }
  } else {
    console.warn(
      '[docuseal-webhook] DOCUSEAL_WEBHOOK_SECRET not set — skipping signature verification.',
    );
    printDocusealWebhookSetup();
  }

  let rawPayload: Record<string, unknown>;
  try {
    rawPayload = JSON.parse(body) as Record<string, unknown>;
  } catch {
    console.warn('[docuseal-webhook] Rejected: invalid JSON body');
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const payload: ContractWebhookPayload = {
    provider: 'docuseal',
    rawPayload,
  };

  console.log('[docuseal-webhook] Event verified, enqueuing', {
    eventType: rawPayload.event_type,
    elapsed: Date.now() - receivedAt,
  });

  await enqueue(TOPICS.CONTRACT_WEBHOOK, payload, processContractWebhook);

  console.log('[docuseal-webhook] Event enqueued successfully', {
    totalElapsed: Date.now() - receivedAt,
  });

  return NextResponse.json({ received: true });
}
