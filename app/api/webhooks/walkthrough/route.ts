import { NextRequest, NextResponse } from 'next/server';
import { getSchedulingAdapter, type SchedulingProvider } from '@/lib/onboarding-providers/scheduling';
import { enqueue, TOPICS } from '@/lib/queue';
import {
  processWalkthroughWebhook,
  type WalkthroughWebhookPayload,
} from '@/app/onboarding/actions';

export async function POST(req: NextRequest) {
  const provider = req.nextUrl.searchParams.get('provider') as SchedulingProvider | null;

  if (!provider || !['calendly', 'google_meet'].includes(provider)) {
    return NextResponse.json({ error: 'Invalid or missing provider.' }, { status: 400 });
  }

  const body = await req.text();
  const headers: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });

  const adapter = getSchedulingAdapter(provider);

  const receivedAt = Date.now();

  console.log(`[walkthrough-webhook] Incoming request`, {
    timestamp: new Date(receivedAt).toISOString(),
    provider,
    bodySize: body.length,
  });

  if (!adapter.verifyWebhookSignature(body, headers)) {
    console.error(`[walkthrough-webhook] Rejected: invalid signature`, { provider });
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 401 });
  }

  let rawPayload: Record<string, unknown>;
  try {
    rawPayload = JSON.parse(body) as Record<string, unknown>;
  } catch {
    console.warn(`[walkthrough-webhook] Rejected: invalid JSON body`, { provider });
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const payload: WalkthroughWebhookPayload = { provider, rawPayload };

  console.log(`[walkthrough-webhook] Event verified, enqueuing`, {
    provider,
    elapsed: Date.now() - receivedAt,
  });

  await enqueue(TOPICS.WALKTHROUGH_WEBHOOK, payload, processWalkthroughWebhook);

  console.log(`[walkthrough-webhook] Event enqueued successfully`, {
    provider,
    totalElapsed: Date.now() - receivedAt,
  });

  return NextResponse.json({ received: true });
}
