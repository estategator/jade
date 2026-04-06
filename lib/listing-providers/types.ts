/**
 * Listing provider abstraction types.
 *
 * Each supported listing site (EstateSales.Net, Whatnot, Etsy,
 * Heritage Auctions, eBay) implements a common connection lifecycle
 * used by settings UI + sale publishing dispatch.
 */

export type ListingProvider =
  | 'estatesales_net'
  | 'whatnot'
  | 'etsy'
  | 'heritage_auctions'
  | 'ebay';

export type ListingConnectionStatus = 'pending' | 'connected' | 'error' | 'disconnected';

export type ListingAuthType = 'oauth' | 'api_key';

export type ListingSyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

export type PlatformListingStatus = 'active' | 'archived' | 'sold' | 'error';

export interface ListingProviderConnection {
  id: string;
  orgId: string;
  provider: ListingProvider;
  externalAccountId: string;
  status: ListingConnectionStatus;
  isDefault: boolean;
  authType: ListingAuthType;
  syncStatus: ListingSyncStatus;
  lastSyncAt: string | null;
  lastError: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ListingProviderConnectionStatus {
  provider: ListingProvider;
  connected: boolean;
  externalAccountId: string | null;
  isDefault: boolean;
  username: string | null;
  syncStatus: ListingSyncStatus | null;
  lastSyncAt: string | null;
}

export interface ListingProviderDisplayInfo {
  provider: ListingProvider;
  name: string;
  description: string;
  icon: string;
  brandColor: string;
  darkBrandColor: string;
  dashboardUrl: string | null;
  /** Whether the provider uses OAuth (vs manual API key entry). */
  oauthSupported: boolean;
  /** Fields the user must provide for manual connection. */
  connectionFields: ConnectionField[];
  /** Provider capabilities for UI hints. */
  capabilities: ProviderCapabilities;
}

export interface ProviderCapabilities {
  /** Can publish inventory items to this platform. */
  canPublish: boolean;
  /** Can sync orders/sales back from this platform. */
  canSyncOrders: boolean;
  /** Supports webhook-based real-time order notifications. */
  supportsWebhooks: boolean;
}

export interface ConnectionField {
  key: string;
  label: string;
  type: 'text' | 'password';
  placeholder: string;
  helpText?: string;
  helpUrl?: string;
}

/** Shape of an inventory item mapped for external platform publishing. */
export interface PlatformListingPayload {
  title: string;
  description: string;
  price: number;
  quantity: number;
  imageUrls: string[];
  condition?: string;
  metadata?: Record<string, unknown>;
}

/** A record tracking a published listing on an external platform. */
export interface PlatformListing {
  id: string;
  orgId: string;
  inventoryItemId: string;
  provider: ListingProvider;
  externalListingId: string;
  externalData: Record<string, unknown>;
  status: PlatformListingStatus;
  publishedAt: string;
  lastSyncedAt: string | null;
}

/** An order received from an external platform. */
export interface ExternalOrder {
  id: string;
  orgId: string;
  provider: ListingProvider;
  externalOrderId: string;
  externalItemId: string | null;
  inventoryItemId: string | null;
  status: string;
  quantity: number;
  listingPrice: number;
  externalData: Record<string, unknown>;
  syncedAt: string;
  createdAt: string;
}

/** Interface each listing provider must implement for publishing. */
export interface ListingProviderAdapter {
  /** Validate stored credentials are still working. */
  validateConnection(credentials: Record<string, string>): Promise<{ valid: boolean; error?: string }>;
  /** Publish an inventory item to the platform. Returns the external listing ID. */
  publishItem(credentials: Record<string, string>, item: PlatformListingPayload): Promise<{ externalListingId: string; externalData?: Record<string, unknown>; error?: string }>;
  /** Fetch recent orders/sales since a given timestamp. */
  fetchOrders(credentials: Record<string, string>, since: string | null): Promise<{ orders: ExternalOrder[]; error?: string }>;
}

export const LISTING_PROVIDER_DISPLAY: Record<ListingProvider, ListingProviderDisplayInfo> = {
  estatesales_net: {
    provider: 'estatesales_net',
    name: 'EstateSales.NET',
    description: 'Publish sales directly to EstateSales.NET, the leading estate sale marketplace.',
    icon: 'Globe',
    brandColor: 'text-emerald-700',
    darkBrandColor: 'dark:text-emerald-400',
    dashboardUrl: 'https://www.estatesales.net/account',
    oauthSupported: false,
    connectionFields: [
      {
        key: 'username',
        label: 'Username',
        type: 'text',
        placeholder: 'you@example.com',
        helpText: 'The email address used to log in to EstateSales.NET.',
      },
      {
        key: 'api_key',
        label: 'API Key',
        type: 'password',
        placeholder: 'Enter your API key',
        helpText: 'Create one at the API Keys page, then paste it here.',
        helpUrl: 'https://www.estatesales.net/account/company/api-keys',
      },
      {
        key: 'organization_id',
        label: 'Organization ID',
        type: 'text',
        placeholder: '#000000',
        helpText: 'Found on your Company Settings page, formatted as #000000.',
      },
    ],
    capabilities: { canPublish: true, canSyncOrders: false, supportsWebhooks: false },
  },
  whatnot: {
    provider: 'whatnot',
    name: 'Whatnot',
    description: 'List items on Whatnot for live-stream auctions and fixed-price sales.',
    icon: 'ShoppingBag',
    brandColor: 'text-indigo-700',
    darkBrandColor: 'dark:text-indigo-400',
    dashboardUrl: 'https://www.whatnot.com/seller/dashboard',
    oauthSupported: true,
    connectionFields: [],
    capabilities: { canPublish: true, canSyncOrders: true, supportsWebhooks: true },
  },
  etsy: {
    provider: 'etsy',
    name: 'Etsy',
    description: 'Reach millions of buyers by listing estate sale items on Etsy.',
    icon: 'Store',
    brandColor: 'text-orange-700',
    darkBrandColor: 'dark:text-orange-400',
    dashboardUrl: 'https://www.etsy.com/your/shops/me/dashboard',
    oauthSupported: true,
    connectionFields: [],
    capabilities: { canPublish: true, canSyncOrders: true, supportsWebhooks: true },
  },
  heritage_auctions: {
    provider: 'heritage_auctions',
    name: 'Heritage Auctions',
    description: 'Submit high-value items to Heritage Auctions, the world\'s largest collectibles auctioneer.',
    icon: 'Gavel',
    brandColor: 'text-stone-700',
    darkBrandColor: 'dark:text-stone-400',
    dashboardUrl: 'https://www.ha.com/my-account',
    oauthSupported: false,
    connectionFields: [
      {
        key: 'api_key',
        label: 'API Key',
        type: 'password',
        placeholder: 'Enter your Heritage Auctions API key',
        helpText: 'Found in your Heritage Auctions account under API Settings.',
      },
      {
        key: 'account_id',
        label: 'Account ID',
        type: 'text',
        placeholder: 'Your Heritage Auctions account ID',
        helpText: 'The numeric account ID shown in your profile.',
      },
    ],
    capabilities: { canPublish: true, canSyncOrders: true, supportsWebhooks: false },
  },
  ebay: {
    provider: 'ebay',
    name: 'eBay',
    description: 'List items on the world\'s largest online auction and shopping marketplace.',
    icon: 'ShoppingCart',
    brandColor: 'text-red-700',
    darkBrandColor: 'dark:text-red-400',
    dashboardUrl: 'https://www.ebay.com/sh/ovw',
    oauthSupported: true,
    connectionFields: [],
    capabilities: { canPublish: true, canSyncOrders: true, supportsWebhooks: true },
  },
};

export const ALL_LISTING_PROVIDERS: ListingProvider[] = [
  'estatesales_net',
  'whatnot',
  'etsy',
  'heritage_auctions',
  'ebay',
];
