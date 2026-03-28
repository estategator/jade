import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import Stripe from 'stripe';
import { enqueue, TOPICS } from '@/lib/queue';
import { processWebhookEvent, type WebhookPayload } from '@/app/api/queues/stripe-webhook/route';

export async function POST(req: NextRequest) {
  const receivedAt = Date.now();
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');

  console.log('[stripe-webhook] Incoming request', {
    timestamp: new Date(receivedAt).toISOString(),
    bodySize: body.length,
    hasSignature: !!sig,
  });

  if (!sig) {
    console.warn('[stripe-webhook] Rejected: missing stripe-signature header');
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
    console.log('[stripe-webhook] Verified as v2 thin event', {
      type: notification.type,
      id: notification.id,
      hasRelatedObject: !!relatedObj,
    });

    // v2 thin events don't include the full object — hydrate from Stripe API
    if (!notification.type.startsWith('v2.')) {
      // v1-type events (e.g. checkout.session.completed) sent via v2 destination:
      // retrieve the full event snapshot so the queue processor has all fields.
      const fullEvent = await stripe.events.retrieve(notification.id);
      payload.data = fullEvent.data.object as unknown as Record<string, unknown>;
      console.log('[stripe-webhook] Hydrated v2 thin event with full v1 snapshot', {
        type: notification.type,
        id: notification.id,
        dataObjectType: fullEvent.data.object?.object,
      });
    }
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
      console.log('[stripe-webhook] Verified as v1 connected event', {
        type: event.type,
        id: event.id,
      });
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
      console.log('[stripe-webhook] Verified as v1 platform event', {
        type: event.type,
        id: event.id,
      });
    } catch (err) {
      console.error('[stripe-webhook] Signature verification failed for ALL secrets', {
        error: err instanceof Error ? err.message : String(err),
        elapsed: Date.now() - receivedAt,
      });
      return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 });
    }
  }

  console.log('[stripe-webhook] Enqueuing event for processing', {
    eventType: payload.eventType,
    eventId: payload.eventId,
    elapsed: Date.now() - receivedAt,
  });

  await enqueue(TOPICS.STRIPE_WEBHOOK, payload, processWebhookEvent);

  console.log('[stripe-webhook] Event enqueued successfully', {
    eventType: payload.eventType,
    eventId: payload.eventId,
    totalElapsed: Date.now() - receivedAt,
  });

  return NextResponse.json({ received: true });
}
