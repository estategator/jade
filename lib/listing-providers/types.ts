/**
 * Listing provider abstraction types.
 *
 * Each supported listing site (EstateSales.Net, etc.) implements a common
 * connection lifecycle used by settings UI + sale publishing dispatch.
 */

export type ListingProvider = 'estatesales_net';

export type ListingConnectionStatus = 'pending' | 'connected' | 'error' | 'disconnected';

export interface ListingProviderConnection {
  id: string;
  orgId: string;
  provider: ListingProvider;
  externalAccountId: string;
  status: ListingConnectionStatus;
  isDefault: boolean;
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
}

export interface ConnectionField {
  key: string;
  label: string;
  type: 'text' | 'password';
  placeholder: string;
  helpText?: string;
  helpUrl?: string;
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
  },
};

export const ALL_LISTING_PROVIDERS: ListingProvider[] = ['estatesales_net'];
