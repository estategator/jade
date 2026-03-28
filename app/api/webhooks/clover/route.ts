import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { enqueue, TOPICS } from '@/lib/queue';
import { type CloverWebhookPayload, processWebhookEvent } from '@/app/api/queues/clover-webhook/route';

const CLOVER_WEBHOOK_SECRET = process.env.CLOVER_WEBHOOK_SECRET!;

function verifyCloverSignature(body: string, signature: string): boolean {
  const hmac = createHmac('sha256', CLOVER_WEBHOOK_SECRET);
  hmac.update(body);
  const expected = hmac.digest('hex');
  // Timing-safe comparison
  if (expected.length !== signature.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return mismatch === 0;
}

export async function POST(req: NextRequest) {
  const receivedAt = Date.now();
  const body = await req.text();
  const signature = req.headers.get('x-clover-hmac-sha256') ?? req.headers.get('x-clover-signature') ?? '';

  console.log('[clover-webhook] Incoming request', {
    timestamp: new Date(receivedAt).toISOString(),
    bodySize: body.length,
    hasSignature: !!signature,
    signatureHeader: signature ? 'x-clover-hmac-sha256' : 'none',
  });

  if (!signature || !verifyCloverSignature(body, signature)) {
    console.warn('[clover-webhook] Rejected: invalid or missing signature');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const event = JSON.parse(body);
  const eventType = event.type ?? event.eventType ?? '';
  const merchantId = event.merchant_id ?? event.merchantId ?? '';

  console.log('[clover-webhook] Event verified', {
    eventType,
    merchantId,
    elapsed: Date.now() - receivedAt,
  });

  const payload: CloverWebhookPayload = {
    eventType,
    merchantId,
    data: event.data ?? event,
  };

  await enqueue(TOPICS.CLOVER_WEBHOOK, payload, processWebhookEvent);

  console.log('[clover-webhook] Event enqueued successfully', {
    eventType,
    merchantId,
    totalElapsed: Date.now() - receivedAt,
  });

  return NextResponse.json({ received: true });
}
