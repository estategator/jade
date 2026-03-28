import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { enqueue, TOPICS } from '@/lib/queue';
import { type SquareWebhookPayload, processWebhookEvent } from '@/app/api/queues/square-webhook/route';

const SQUARE_WEBHOOK_SIGNATURE_KEY = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY!;
const SQUARE_WEBHOOK_URL = process.env.SQUARE_WEBHOOK_URL!;

function verifySquareSignature(body: string, signature: string): boolean {
  const hmac = createHmac('sha256', SQUARE_WEBHOOK_SIGNATURE_KEY);
  hmac.update(SQUARE_WEBHOOK_URL + body);
  const expected = hmac.digest('base64');
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
  const signature = req.headers.get('x-square-hmacsha256-signature');

  console.log('[square-webhook] Incoming request', {
    timestamp: new Date(receivedAt).toISOString(),
    bodySize: body.length,
    hasSignature: !!signature,
  });

  if (!signature) {
    console.warn('[square-webhook] Rejected: missing x-square-hmacsha256-signature header');
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  if (!verifySquareSignature(body, signature)) {
    console.warn('[square-webhook] Rejected: signature verification failed');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const event = JSON.parse(body);

  console.log('[square-webhook] Event verified', {
    type: event.type,
    eventId: event.event_id,
    merchantId: event.merchant_id,
    elapsed: Date.now() - receivedAt,
  });

  const payload: SquareWebhookPayload = {
    eventType: event.type,
    eventId: event.event_id ?? '',
    merchantId: event.merchant_id ?? '',
    data: event.data ?? {},
  };

  await enqueue(TOPICS.SQUARE_WEBHOOK, payload, processWebhookEvent);

  console.log('[square-webhook] Event enqueued successfully', {
    type: event.type,
    eventId: event.event_id,
    totalElapsed: Date.now() - receivedAt,
  });

  return NextResponse.json({ received: true });
}
