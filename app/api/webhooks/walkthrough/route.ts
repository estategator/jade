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

  if (!adapter.verifyWebhookSignature(body, headers)) {
    console.error(`[walkthrough-webhook] Invalid signature for provider: ${provider}`);
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 401 });
  }

  let rawPayload: Record<string, unknown>;
  try {
    rawPayload = JSON.parse(body) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const payload: WalkthroughWebhookPayload = { provider, rawPayload };

  console.log(`[walkthrough-webhook] Received ${provider} event, enqueuing.`);

  await enqueue(TOPICS.WALKTHROUGH_WEBHOOK, payload, processWalkthroughWebhook);

  return NextResponse.json({ received: true });
}
