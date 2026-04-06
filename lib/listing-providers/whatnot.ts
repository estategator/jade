/**
 * Whatnot Seller API client.
 *
 * Handles publishing listings and fetching orders from Whatnot's
 * live-stream auction and fixed-price marketplace.
 */

import { PLATFORM_METADATA } from './platform-metadata';
import type { ListingProviderAdapter, PlatformListingPayload, ExternalOrder } from './types';

const meta = PLATFORM_METADATA.whatnot;

function headers(accessToken: string) {
  return {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
}

export const whatnotAdapter: ListingProviderAdapter = {
  async validateConnection(credentials) {
    const { access_token } = credentials;
    if (!access_token) return { valid: false, error: 'Missing access token.' };

    try {
      const res = await fetch(`${meta.apiBaseUrl}/seller/me`, {
        method: 'GET',
        headers: headers(access_token),
      });

      if (res.status === 401 || res.status === 403) {
        return { valid: false, error: 'Access token is invalid or expired. Please reconnect.' };
      }
      if (!res.ok) {
        return { valid: false, error: `Whatnot returned status ${res.status}.` };
      }

      return { valid: true };
    } catch {
      return { valid: false, error: 'Could not reach Whatnot. Please try again later.' };
    }
  },

  async publishItem(credentials, item: PlatformListingPayload) {
    const { access_token } = credentials;
    if (!access_token) return { externalListingId: '', error: 'Missing access token.' };

    try {
      const body = {
        title: item.title,
        description: item.description,
        price_cents: Math.round(item.price * 100),
        quantity: item.quantity,
        images: item.imageUrls,
        condition: item.condition ?? 'used',
        ...(item.metadata ?? {}),
      };

      const res = await fetch(`${meta.apiBaseUrl}/seller/listings`, {
        method: 'POST',
        headers: headers(access_token),
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error('[whatnot] Publish failed:', text);
        return { externalListingId: '', error: `Failed to publish: ${res.status}` };
      }

      const data = await res.json() as { id: string; [k: string]: unknown };
      return { externalListingId: data.id, externalData: data };
    } catch (err) {
      console.error('[whatnot] Publish error:', err);
      return { externalListingId: '', error: 'Network error publishing to Whatnot.' };
    }
  },

  async fetchOrders(credentials, since) {
    const { access_token } = credentials;
    if (!access_token) return { orders: [], error: 'Missing access token.' };

    try {
      const params = new URLSearchParams({ limit: '100' });
      if (since) params.set('created_after', since);

      const res = await fetch(`${meta.apiBaseUrl}/seller/orders?${params.toString()}`, {
        method: 'GET',
        headers: headers(access_token),
      });

      if (!res.ok) {
        return { orders: [], error: `Whatnot returned status ${res.status}.` };
      }

      const data = await res.json() as {
        orders: Array<{
          id: string;
          listing_id: string;
          quantity: number;
          price_cents: number;
          status: string;
          buyer: Record<string, unknown>;
          created_at: string;
          [k: string]: unknown;
        }>;
      };

      const orders: ExternalOrder[] = (data.orders ?? []).map((o) => ({
        id: '',
        orgId: '',
        provider: 'whatnot' as const,
        externalOrderId: o.id,
        externalItemId: o.listing_id,
        inventoryItemId: null,
        status: 'received',
        quantity: o.quantity,
        listingPrice: o.price_cents / 100,
        externalData: o as unknown as Record<string, unknown>,
        syncedAt: new Date().toISOString(),
        createdAt: o.created_at,
      }));

      return { orders };
    } catch (err) {
      console.error('[whatnot] Fetch orders error:', err);
      return { orders: [], error: 'Network error fetching Whatnot orders.' };
    }
  },
};
