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
  const body = await req.text();
  const signature = req.headers.get('x-square-hmacsha256-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  if (!verifySquareSignature(body, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const event = JSON.parse(body);

  console.log('[square-webhook] Received event:', event.type, 'id:', event.event_id);

  const payload: SquareWebhookPayload = {
    eventType: event.type,
    eventId: event.event_id ?? '',
    merchantId: event.merchant_id ?? '',
    data: event.data ?? {},
  };

  await enqueue(TOPICS.SQUARE_WEBHOOK, payload, processWebhookEvent);

  return NextResponse.json({ received: true });
}
