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

  const platformSecret = process.env.STRIPE_WEBHOOK_SECRET!;
  const connectSecret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET!;

  let payload: WebhookPayload | null = null;

  // Attempt 1: v2 thin event (connected/v2 secret) — most common for checkout
  try {
    const notification = stripe.parseEventNotification(body, sig, connectSecret);
    const relatedObj = 'related_object' in notification && notification.related_object
      ? notification.related_object as { id: string; type: string; url: string }
      : undefined;
    payload = {
      eventType: notification.type,
      eventId: notification.id,
      data: {},
      relatedObject: relatedObj
        ? { id: relatedObj.id, type: relatedObj.type, url: relatedObj.url }
        : undefined,
    };
    console.log('[stripe-webhook] v2 thin event:', notification.type, 'id:', notification.id);
  } catch {
    // Not a v2 thin event — continue
  }

  // Attempt 2: v1 snapshot from connected account (connect secret)
  if (!payload) {
    try {
      const event: Stripe.Event = stripe.webhooks.constructEvent(body, sig, connectSecret);
      payload = {
        eventType: event.type,
        eventId: event.id,
        data: event.data.object as unknown as Record<string, unknown>,
      };
      console.log('[stripe-webhook] v1 connected event:', event.type, 'id:', event.id);
    } catch {
      // Not a v1 connected event — continue
    }
  }

  // Attempt 3: v1 snapshot from platform account (platform secret)
  if (!payload) {
    try {
      const event: Stripe.Event = stripe.webhooks.constructEvent(body, sig, platformSecret);
      payload = {
        eventType: event.type,
        eventId: event.id,
        data: event.data.object as unknown as Record<string, unknown>,
      };
      console.log('[stripe-webhook] v1 platform event:', event.type, 'id:', event.id);
    } catch (err) {
      console.error('Webhook signature verification failed for all secrets:', err);
      return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 });
    }
  }

  await enqueue(TOPICS.STRIPE_WEBHOOK, payload, processWebhookEvent);

  return NextResponse.json({ received: true });
}
