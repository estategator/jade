/**
 * eBay REST API client.
 *
 * Handles publishing inventory items and fetching orders using eBay's
 * Sell APIs (Inventory API for listings, Fulfillment API for orders).
 * Uses OAuth 2.0 for authentication.
 */

import { PLATFORM_METADATA } from './platform-metadata';
import type { ListingProviderAdapter, PlatformListingPayload, ExternalOrder } from './types';

const meta = PLATFORM_METADATA.ebay;

function headers(accessToken: string) {
  return {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
}

export const ebayAdapter: ListingProviderAdapter = {
  async validateConnection(credentials) {
    const { access_token } = credentials;
    if (!access_token) return { valid: false, error: 'Missing access token.' };

    try {
      // Use the Sell Account API to verify the token
      const res = await fetch(`${meta.apiBaseUrl}/sell/account/v1/privilege`, {
        method: 'GET',
        headers: headers(access_token),
      });

      if (res.status === 401 || res.status === 403) {
        return { valid: false, error: 'Access token is invalid or expired. Please reconnect.' };
      }
      if (!res.ok) {
        return { valid: false, error: `eBay returned status ${res.status}.` };
      }

      return { valid: true };
    } catch {
      return { valid: false, error: 'Could not reach eBay. Please try again later.' };
    }
  },

  async publishItem(credentials, item: PlatformListingPayload) {
    const { access_token } = credentials;
    if (!access_token) return { externalListingId: '', error: 'Missing access token.' };

    try {
      // Step 1: Create or update inventory item
      const sku = `curator-${Date.now()}`;
      const inventoryBody = {
        product: {
          title: item.title.slice(0, 80),
          description: item.description,
          imageUrls: item.imageUrls,
        },
        condition: mapCondition(item.condition),
        availability: {
          shipToLocationAvailability: {
            quantity: item.quantity,
          },
        },
      };

      const invRes = await fetch(`${meta.apiBaseUrl}/sell/inventory/v1/inventory_item/${sku}`, {
        method: 'PUT',
        headers: {
          ...headers(access_token),
          'Content-Language': 'en-US',
        },
        body: JSON.stringify(inventoryBody),
      });

      if (!invRes.ok && invRes.status !== 204) {
        const text = await invRes.text();
        console.error('[ebay] Create inventory item failed:', text);
        return { externalListingId: '', error: `Failed to create eBay item: ${invRes.status}` };
      }

      // Step 2: Create offer for the inventory item
      const offerBody = {
        sku,
        marketplaceId: 'EBAY_US',
        format: 'FIXED_PRICE',
        listingDuration: 'GTC',
        pricingSummary: {
          price: {
            value: String(item.price),
            currency: 'USD',
          },
        },
        availableQuantity: item.quantity,
      };

      const offerRes = await fetch(`${meta.apiBaseUrl}/sell/inventory/v1/offer`, {
        method: 'POST',
        headers: {
          ...headers(access_token),
          'Content-Language': 'en-US',
        },
        body: JSON.stringify(offerBody),
      });

      if (!offerRes.ok) {
        const text = await offerRes.text();
        console.error('[ebay] Create offer failed:', text);
        return { externalListingId: '', error: `Failed to create eBay offer: ${offerRes.status}` };
      }

      const offerData = await offerRes.json() as { offerId: string };

      // Step 3: Publish the offer
      const publishRes = await fetch(
        `${meta.apiBaseUrl}/sell/inventory/v1/offer/${offerData.offerId}/publish`,
        { method: 'POST', headers: headers(access_token) },
      );

      if (!publishRes.ok) {
        const text = await publishRes.text();
        console.error('[ebay] Publish offer failed:', text);
        return { externalListingId: offerData.offerId, error: `Offer created but publish failed: ${publishRes.status}` };
      }

      const publishData = await publishRes.json() as { listingId: string; [k: string]: unknown };
      return {
        externalListingId: publishData.listingId,
        externalData: { sku, offerId: offerData.offerId, ...publishData },
      };
    } catch (err) {
      console.error('[ebay] Publish error:', err);
      return { externalListingId: '', error: 'Network error publishing to eBay.' };
    }
  },

  async fetchOrders(credentials, since) {
    const { access_token } = credentials;
    if (!access_token) return { orders: [], error: 'Missing access token.' };

    try {
      const params = new URLSearchParams({ limit: '50' });
      if (since) {
        // eBay uses ISO 8601 with range filter
        params.set('filter', `creationdate:[${since}..${new Date().toISOString()}]`);
      }

      const res = await fetch(
        `${meta.apiBaseUrl}/sell/fulfillment/v1/order?${params.toString()}`,
        { method: 'GET', headers: headers(access_token) },
      );

      if (!res.ok) {
        return { orders: [], error: `eBay returned status ${res.status}.` };
      }

      const data = await res.json() as {
        orders: Array<{
          orderId: string;
          lineItems: Array<{
            lineItemId: string;
            legacyItemId: string;
            quantity: number;
            lineItemCost: { value: string; currency: string };
          }>;
          orderFulfillmentStatus: string;
          buyer: { username: string };
          creationDate: string;
          [k: string]: unknown;
        }>;
      };

      const orders: ExternalOrder[] = (data.orders ?? []).flatMap((order) =>
        order.lineItems.map((li) => ({
          id: '',
          orgId: '',
          provider: 'ebay' as const,
          externalOrderId: order.orderId,
          externalItemId: li.legacyItemId,
          inventoryItemId: null,
          status: 'received',
          quantity: li.quantity,
          listingPrice: parseFloat(li.lineItemCost.value),
          externalData: order as unknown as Record<string, unknown>,
          syncedAt: new Date().toISOString(),
          createdAt: order.creationDate,
        })),
      );

      return { orders };
    } catch (err) {
      console.error('[ebay] Fetch orders error:', err);
      return { orders: [], error: 'Network error fetching eBay orders.' };
    }
  },
};

/** Map Curator condition values to eBay condition enums. */
function mapCondition(condition?: string): string {
  switch (condition?.toLowerCase()) {
    case 'new':
    case 'mint':
      return 'NEW';
    case 'excellent':
      return 'LIKE_NEW';
    case 'good':
      return 'VERY_GOOD';
    case 'fair':
      return 'GOOD';
    case 'poor':
      return 'ACCEPTABLE';
    default:
      return 'USED_GOOD';
  }
}
