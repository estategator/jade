/**
 * Heritage Auctions API client.
 *
 * Handles submitting lots (consignment items) and fetching auction
 * results from Heritage Auctions. Uses API key authentication.
 */

import { PLATFORM_METADATA } from './platform-metadata';
import type { ListingProviderAdapter, PlatformListingPayload, ExternalOrder } from './types';

const meta = PLATFORM_METADATA.heritage_auctions;

function headers(apiKey: string) {
  return {
    'X-HA-Api-Key': apiKey,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
}

export const heritageAuctionsAdapter: ListingProviderAdapter = {
  async validateConnection(credentials) {
    const { api_key, account_id } = credentials;
    if (!api_key) return { valid: false, error: 'Missing API key.' };
    if (!account_id) return { valid: false, error: 'Missing account ID.' };

    try {
      const res = await fetch(`${meta.apiBaseUrl}/accounts/${account_id}`, {
        method: 'GET',
        headers: headers(api_key),
      });

      if (res.status === 401 || res.status === 403) {
        return { valid: false, error: 'Invalid API key.' };
      }
      if (res.status === 404) {
        return { valid: false, error: 'Account ID not found.' };
      }
      if (!res.ok) {
        return { valid: false, error: `Heritage Auctions returned status ${res.status}.` };
      }

      return { valid: true };
    } catch {
      return { valid: false, error: 'Could not reach Heritage Auctions. Please try again later.' };
    }
  },

  async publishItem(credentials, item: PlatformListingPayload) {
    const { api_key, account_id } = credentials;
    if (!api_key || !account_id) {
      return { externalListingId: '', error: 'Missing API key or account ID.' };
    }

    try {
      const body = {
        account_id,
        title: item.title,
        description: item.description,
        estimate_low: item.price,
        estimate_high: Math.round(item.price * 1.5),
        quantity: item.quantity,
        images: item.imageUrls,
        condition: item.condition ?? 'good',
        ...(item.metadata ?? {}),
      };

      const res = await fetch(`${meta.apiBaseUrl}/consignments`, {
        method: 'POST',
        headers: headers(api_key),
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error('[heritage_auctions] Publish failed:', text);
        return { externalListingId: '', error: `Failed to submit lot: ${res.status}` };
      }

      const data = await res.json() as { lot_id: string; [k: string]: unknown };
      return { externalListingId: data.lot_id, externalData: data };
    } catch (err) {
      console.error('[heritage_auctions] Publish error:', err);
      return { externalListingId: '', error: 'Network error submitting to Heritage Auctions.' };
    }
  },

  async fetchOrders(credentials, since) {
    const { api_key, account_id } = credentials;
    if (!api_key || !account_id) {
      return { orders: [], error: 'Missing API key or account ID.' };
    }

    try {
      const params = new URLSearchParams({
        account_id,
        limit: '100',
        status: 'sold',
      });
      if (since) params.set('since', since);

      const res = await fetch(`${meta.apiBaseUrl}/auction-results?${params.toString()}`, {
        method: 'GET',
        headers: headers(api_key),
      });

      if (!res.ok) {
        return { orders: [], error: `Heritage Auctions returned status ${res.status}.` };
      }

      const data = await res.json() as {
        results: Array<{
          lot_id: string;
          sale_id: string;
          hammer_price: number;
          quantity: number;
          buyer: Record<string, unknown>;
          sold_at: string;
          [k: string]: unknown;
        }>;
      };

      const orders: ExternalOrder[] = (data.results ?? []).map((r) => ({
        id: '',
        orgId: '',
        provider: 'heritage_auctions' as const,
        externalOrderId: r.sale_id,
        externalItemId: r.lot_id,
        inventoryItemId: null,
        status: 'received',
        quantity: r.quantity,
        listingPrice: r.hammer_price,
        externalData: r as unknown as Record<string, unknown>,
        syncedAt: new Date().toISOString(),
        createdAt: r.sold_at,
      }));

      return { orders };
    } catch (err) {
      console.error('[heritage_auctions] Fetch orders error:', err);
      return { orders: [], error: 'Network error fetching Heritage Auctions results.' };
    }
  },
};
