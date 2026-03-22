import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import Stripe from 'stripe';
import { enqueue, TOPICS } from '@/lib/queue';
import { processWebhookEvent, type WebhookPayload } from '@/app/api/queues/stripe-webhook/route';

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');

  if (!sig) {
    return NextResponse.json({ error: 'Missing signature.' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 });
  }

  const payload: WebhookPayload = {
    eventType: event.type,
    eventId: event.id,
    data: event.data.object as unknown as Record<string, unknown>,
  };

  console.log('[stripe-webhook] Received event:', event.type, 'id:', event.id);

  await enqueue(TOPICS.STRIPE_WEBHOOK, payload, processWebhookEvent);

  return NextResponse.json({ received: true });
}
