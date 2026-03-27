import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Scheduling provider abstraction for onboarding walkthroughs.
 *
 * Calendly is the scheduling system of record. Google Meet is treated
 * as meeting-URL enrichment (Calendly auto-generates Meet links when
 * configured, or we create a Meet link after booking).
 */

// ── Types ────────────────────────────────────────────────────

export type SchedulingProvider = 'calendly' | 'google_meet' | 'manual';

export type WalkthroughInviteRequest = {
  /** Internal walkthrough_sessions row ID — used for metadata. */
  walkthroughId: string;
  /** Calendly event type URI. */
  eventTypeUri?: string;
  /** Invitee details. */
  inviteeName: string;
  inviteeEmail: string;
  /** Arbitrary metadata forwarded to the scheduling provider. */
  metadata?: Record<string, string>;
};

export type WalkthroughInviteResult = {
  /** Provider-assigned event/invite ID. */
  externalEventId: string;
  /** Scheduling link for the invitee (or booking confirmation URL). */
  schedulingUrl: string;
  /** Meeting URL if already known (e.g. auto-generated Meet link). */
  meetingUrl?: string;
  /** Booked start time if immediately confirmed. */
  scheduledStartAt?: string;
  scheduledEndAt?: string;
  rawResponse?: Record<string, unknown>;
};

export type WalkthroughStatusResult = {
  status: 'pending' | 'scheduled' | 'completed' | 'canceled' | 'rescheduled';
  scheduledStartAt?: string;
  scheduledEndAt?: string;
  meetingUrl?: string;
  rawResponse?: Record<string, unknown>;
};

/** Normalized webhook event from any scheduling provider. */
export type NormalizedWalkthroughEvent = {
  externalEventId: string;
  eventType: string;
  normalizedStatus: WalkthroughStatusResult['status'];
  scheduledStartAt?: string;
  scheduledEndAt?: string;
  meetingUrl?: string;
  timestamp: string;
  rawPayload: Record<string, unknown>;
};

// ── Adapter interface ────────────────────────────────────────

export interface SchedulingProviderAdapter {
  /** Create an invite / scheduling link for the invitee. */
  createInvite(request: WalkthroughInviteRequest): Promise<WalkthroughInviteResult>;

  /** Fetch the current status of a booked event. */
  getStatus(externalEventId: string): Promise<WalkthroughStatusResult>;

  /** Normalize a raw webhook payload into a standard event shape. */
  normalizeWebhookEvent(payload: Record<string, unknown>): NormalizedWalkthroughEvent | null;

  /** Verify the webhook signature. Returns true if valid. */
  verifyWebhookSignature(body: string, headers: Record<string, string>): boolean;
}

// ── Calendly adapter ─────────────────────────────────────────

function calendlyStatusMap(status: string): WalkthroughStatusResult['status'] {
  switch (status.toLowerCase()) {
    case 'active':
      return 'scheduled';
    case 'canceled':
    case 'cancelled':
      return 'canceled';
    default:
      return 'pending';
  }
}

export function createCalendlyAdapter(): SchedulingProviderAdapter {
  const apiToken = process.env.CALENDLY_API_TOKEN ?? '';
  const webhookSigningKey = process.env.CALENDLY_WEBHOOK_SIGNING_KEY ?? '';
  const baseUrl = 'https://api.calendly.com';

  return {
    async createInvite(request) {
      if (!apiToken) {
        throw new Error('Calendly API token not configured. Set CALENDLY_API_TOKEN.');
      }

      // Calendly doesn't have a direct "create invite" API — the standard flow
      // is to generate a scheduling link with prefilled invitee info.
      // We use the single-use scheduling link API.
      const eventTypeUri = request.eventTypeUri ?? process.env.CALENDLY_DEFAULT_EVENT_TYPE;
      if (!eventTypeUri) {
        throw new Error('Calendly event type URI not configured.');
      }

      const res = await fetch(`${baseUrl}/scheduling_links`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          max_event_count: 1,
          owner: eventTypeUri,
          owner_type: 'EventType',
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Calendly scheduling_links failed (${res.status}): ${text}`);
      }

      const data = (await res.json()) as {
        resource: { booking_url: string; owner: string };
      };

      // Append invitee prefill params
      const bookingUrl = new URL(data.resource.booking_url);
      bookingUrl.searchParams.set('name', request.inviteeName);
      bookingUrl.searchParams.set('email', request.inviteeEmail);

      return {
        externalEventId: data.resource.owner,
        schedulingUrl: bookingUrl.toString(),
        rawResponse: data as unknown as Record<string, unknown>,
      };
    },

    async getStatus(externalEventId) {
      if (!apiToken) {
        throw new Error('Calendly API token not configured.');
      }

      const res = await fetch(externalEventId, {
        headers: { Authorization: `Bearer ${apiToken}` },
      });

      if (!res.ok) {
        throw new Error(`Calendly getStatus failed (${res.status})`);
      }

      const data = (await res.json()) as {
        resource: {
          status: string;
          start_time: string;
          end_time: string;
          location?: { join_url?: string };
        };
      };

      return {
        status: calendlyStatusMap(data.resource.status),
        scheduledStartAt: data.resource.start_time,
        scheduledEndAt: data.resource.end_time,
        meetingUrl: data.resource.location?.join_url,
        rawResponse: data as unknown as Record<string, unknown>,
      };
    },

    normalizeWebhookEvent(payload) {
      const event = payload as {
        event?: string;
        created_at?: string;
        payload?: {
          uri?: string;
          status?: string;
          start_time?: string;
          end_time?: string;
          location?: { join_url?: string };
        };
      };

      const uri = event.payload?.uri;
      const eventType = event.event;
      if (!uri || !eventType) return null;

      let normalizedStatus: WalkthroughStatusResult['status'] = 'scheduled';
      if (eventType === 'invitee.canceled') {
        normalizedStatus = 'canceled';
      } else if (eventType === 'invitee.created') {
        normalizedStatus = 'scheduled';
      }

      return {
        externalEventId: uri,
        eventType,
        normalizedStatus,
        scheduledStartAt: event.payload?.start_time,
        scheduledEndAt: event.payload?.end_time,
        meetingUrl: event.payload?.location?.join_url,
        timestamp: event.created_at ?? new Date().toISOString(),
        rawPayload: payload,
      };
    },

    verifyWebhookSignature(body, headers) {
      if (!webhookSigningKey) return false;
      try {
        const signature = headers['calendly-webhook-signature'] ?? '';
        // Calendly uses t=<timestamp>,v1=<hash>
        const parts = Object.fromEntries(
          signature.split(',').map((p: string) => {
            const [k, ...v] = p.split('=');
            return [k, v.join('=')];
          }),
        ) as Record<string, string>;

        const t = parts['t'];
        const v1 = parts['v1'];
        if (!t || !v1) return false;

        const expected = createHmac('sha256', webhookSigningKey)
          .update(`${t}.${body}`)
          .digest('hex');

        return timingSafeEqual(Buffer.from(v1, 'hex'), Buffer.from(expected, 'hex'));
      } catch {
        return false;
      }
    },
  };
}

// ── Manual/no-op adapter ─────────────────────────────────────

export function createManualSchedulingAdapter(): SchedulingProviderAdapter {
  return {
    async createInvite(request) {
      return {
        externalEventId: `manual_${request.walkthroughId}`,
        schedulingUrl: '',
      };
    },
    async getStatus() {
      return { status: 'pending' };
    },
    normalizeWebhookEvent() {
      return null;
    },
    verifyWebhookSignature() {
      return true;
    },
  };
}

// ── Factory ──────────────────────────────────────────────────

export function getSchedulingAdapter(provider: SchedulingProvider): SchedulingProviderAdapter {
  switch (provider) {
    case 'calendly':
      return createCalendlyAdapter();
    case 'google_meet':
      // Google Meet uses Calendly for scheduling + Meet link enrichment
      return createCalendlyAdapter();
    case 'manual':
      return createManualSchedulingAdapter();
    default:
      throw new Error(`Unsupported scheduling provider: ${provider as string}`);
  }
}
