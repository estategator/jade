/**
 * Etsy Open API v3 client.
 *
 * Handles publishing listings and fetching receipts (orders) from Etsy.
 * Uses OAuth 2.0 for authentication with shop-scoped operations.
 */

import { PLATFORM_METADATA } from './platform-metadata';
import type { ListingProviderAdapter, PlatformListingPayload, ExternalOrder } from './types';

const meta = PLATFORM_METADATA.etsy;

function headers(accessToken: string) {
  return {
    'Authorization': `Bearer ${accessToken}`,
    'x-api-key': process.env.ETSY_CLIENT_ID ?? '',
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
}

export const etsyAdapter: ListingProviderAdapter = {
  async validateConnection(credentials) {
    const { access_token, shop_id } = credentials;
    if (!access_token) return { valid: false, error: 'Missing access token.' };
    if (!shop_id) return { valid: false, error: 'Missing shop ID.' };

    try {
      const res = await fetch(`${meta.apiBaseUrl}/application/shops/${shop_id}`, {
        method: 'GET',
        headers: headers(access_token),
      });

      if (res.status === 401 || res.status === 403) {
        return { valid: false, error: 'Access token is invalid or expired. Please reconnect.' };
      }
      if (res.status === 404) {
        return { valid: false, error: 'Shop not found. Check your shop ID.' };
      }
      if (!res.ok) {
        return { valid: false, error: `Etsy returned status ${res.status}.` };
      }

      return { valid: true };
    } catch {
      return { valid: false, error: 'Could not reach Etsy. Please try again later.' };
    }
  },

  async publishItem(credentials, item: PlatformListingPayload) {
    const { access_token, shop_id } = credentials;
    if (!access_token || !shop_id) {
      return { externalListingId: '', error: 'Missing access token or shop ID.' };
    }

    try {
      const body = {
        title: item.title.slice(0, 140),
        description: item.description,
        price: item.price,
        quantity: item.quantity,
        who_made: 'someone_else',
        when_made: 'before_2000',
        taxonomy_id: 1, // General — should be refined per item category
        is_supply: false,
        ...(item.metadata ?? {}),
      };

      const res = await fetch(`${meta.apiBaseUrl}/application/shops/${shop_id}/listings`, {
        method: 'POST',
        headers: headers(access_token),
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error('[etsy] Publish failed:', text);
        return { externalListingId: '', error: `Failed to publish: ${res.status}` };
      }

      const data = await res.json() as { listing_id: number; [k: string]: unknown };
      return {
        externalListingId: String(data.listing_id),
        externalData: data as unknown as Record<string, unknown>,
      };
    } catch (err) {
      console.error('[etsy] Publish error:', err);
      return { externalListingId: '', error: 'Network error publishing to Etsy.' };
    }
  },

  async fetchOrders(credentials, since) {
    const { access_token, shop_id } = credentials;
    if (!access_token || !shop_id) {
      return { orders: [], error: 'Missing access token or shop ID.' };
    }

    try {
      const params = new URLSearchParams({ limit: '100' });
      if (since) {
        const sinceEpoch = Math.floor(new Date(since).getTime() / 1000);
        params.set('min_created', String(sinceEpoch));
      }

      const res = await fetch(
        `${meta.apiBaseUrl}/application/shops/${shop_id}/receipts?${params.toString()}`,
        { method: 'GET', headers: headers(access_token) },
      );

      if (!res.ok) {
        return { orders: [], error: `Etsy returned status ${res.status}.` };
      }

      const data = await res.json() as {
        results: Array<{
          receipt_id: number;
          transactions: Array<{
            listing_id: number;
            quantity: number;
            price: { amount: number; divisor: number };
          }>;
          status: string;
          buyer_email: string;
          create_timestamp: number;
          [k: string]: unknown;
        }>;
      };

      const orders: ExternalOrder[] = (data.results ?? []).flatMap((receipt) =>
        receipt.transactions.map((tx) => ({
          id: '',
          orgId: '',
          provider: 'etsy' as const,
          externalOrderId: String(receipt.receipt_id),
          externalItemId: String(tx.listing_id),
          inventoryItemId: null,
          status: 'received',
          quantity: tx.quantity,
          listingPrice: tx.price.amount / tx.price.divisor,
          externalData: receipt as unknown as Record<string, unknown>,
          syncedAt: new Date().toISOString(),
          createdAt: new Date(receipt.create_timestamp * 1000).toISOString(),
        })),
      );

      return { orders };
    } catch (err) {
      console.error('[etsy] Fetch orders error:', err);
      return { orders: [], error: 'Network error fetching Etsy orders.' };
    }
  },
};
