/**
 * Platform-specific metadata for listing provider OAuth and API configuration.
 *
 * This file centralises OAuth endpoints, required scopes, and API base URLs
 * so that individual provider modules stay focused on business logic.
 */

import type { ListingProvider, ListingAuthType } from './types';

export interface PlatformOAuthConfig {
  authorizeUrl: string;
  tokenUrl: string;
  revokeUrl?: string;
  scopes: string[];
}

export interface PlatformMetadata {
  provider: ListingProvider;
  displayName: string;
  authType: ListingAuthType;
  apiBaseUrl: string;
  /** OAuth configuration — only present for oauth-based providers. */
  oauth?: PlatformOAuthConfig;
  /** Environment variable name for the client ID (OAuth providers). */
  clientIdEnvKey?: string;
  /** Environment variable name for the client secret (OAuth providers). */
  clientSecretEnvKey?: string;
  /** Environment variable name for the webhook secret (webhook providers). */
  webhookSecretEnvKey?: string;
}

export const PLATFORM_METADATA: Record<ListingProvider, PlatformMetadata> = {
  estatesales_net: {
    provider: 'estatesales_net',
    displayName: 'EstateSales.NET',
    authType: 'api_key',
    apiBaseUrl: 'https://www.estatesales.net/api',
  },

  whatnot: {
    provider: 'whatnot',
    displayName: 'Whatnot',
    authType: 'oauth',
    apiBaseUrl: 'https://api.whatnot.com/v1',
    oauth: {
      authorizeUrl: 'https://accounts.whatnot.com/oauth/authorize',
      tokenUrl: 'https://accounts.whatnot.com/oauth/token',
      revokeUrl: 'https://accounts.whatnot.com/oauth/revoke',
      scopes: ['seller:read', 'seller:write', 'orders:read'],
    },
    clientIdEnvKey: 'WHATNOT_CLIENT_ID',
    clientSecretEnvKey: 'WHATNOT_CLIENT_SECRET',
    webhookSecretEnvKey: 'WHATNOT_WEBHOOK_SECRET',
  },

  etsy: {
    provider: 'etsy',
    displayName: 'Etsy',
    authType: 'oauth',
    apiBaseUrl: 'https://openapi.etsy.com/v3',
    oauth: {
      authorizeUrl: 'https://www.etsy.com/oauth/connect',
      tokenUrl: 'https://api.etsy.com/v3/public/oauth/token',
      scopes: ['listings_r', 'listings_w', 'transactions_r', 'shops_r'],
    },
    clientIdEnvKey: 'ETSY_CLIENT_ID',
    clientSecretEnvKey: 'ETSY_CLIENT_SECRET',
    webhookSecretEnvKey: 'ETSY_WEBHOOK_SECRET',
  },

  heritage_auctions: {
    provider: 'heritage_auctions',
    displayName: 'Heritage Auctions',
    authType: 'api_key',
    apiBaseUrl: 'https://api.ha.com/v1',
  },

  ebay: {
    provider: 'ebay',
    displayName: 'eBay',
    authType: 'oauth',
    apiBaseUrl: 'https://api.ebay.com',
    oauth: {
      authorizeUrl: 'https://auth.ebay.com/oauth2/authorize',
      tokenUrl: 'https://api.ebay.com/identity/v1/oauth2/token',
      scopes: [
        'https://api.ebay.com/oauth/api_scope/sell.inventory',
        'https://api.ebay.com/oauth/api_scope/sell.account',
        'https://api.ebay.com/oauth/api_scope/sell.fulfillment',
      ],
    },
    clientIdEnvKey: 'EBAY_CLIENT_ID',
    clientSecretEnvKey: 'EBAY_CLIENT_SECRET',
    webhookSecretEnvKey: 'EBAY_WEBHOOK_SECRET',
  },
};

/**
 * Build the full OAuth authorization URL for a provider.
 * Includes state param (CSRF token) and the redirect URI.
 */
export function buildOAuthUrl(
  provider: ListingProvider,
  orgId: string,
  state: string,
  redirectUri: string,
): string {
  const meta = PLATFORM_METADATA[provider];
  if (!meta.oauth) throw new Error(`${provider} does not support OAuth.`);

  const params = new URLSearchParams({
    client_id: process.env[meta.clientIdEnvKey!] ?? '',
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: meta.oauth.scopes.join(' '),
    state,
  });

  return `${meta.oauth.authorizeUrl}?${params.toString()}`;
}

/**
 * Exchange an OAuth authorization code for access + refresh tokens.
 */
export async function exchangeOAuthCode(
  provider: ListingProvider,
  code: string,
  redirectUri: string,
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number; error?: string }> {
  const meta = PLATFORM_METADATA[provider];
  if (!meta.oauth) throw new Error(`${provider} does not support OAuth.`);

  const clientId = process.env[meta.clientIdEnvKey!] ?? '';
  const clientSecret = process.env[meta.clientSecretEnvKey!] ?? '';

  try {
    const response = await fetch(meta.oauth.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`[${provider}] OAuth token exchange failed:`, text);
      return { accessToken: '', refreshToken: '', expiresIn: 0, error: 'Failed to exchange authorization code.' };
    }

    const data = await response.json() as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    };
  } catch (err) {
    console.error(`[${provider}] OAuth token exchange error:`, err);
    return { accessToken: '', refreshToken: '', expiresIn: 0, error: 'Network error during token exchange.' };
  }
}

/**
 * Refresh an expired OAuth access token.
 */
export async function refreshOAuthToken(
  provider: ListingProvider,
  refreshToken: string,
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number; error?: string }> {
  const meta = PLATFORM_METADATA[provider];
  if (!meta.oauth) throw new Error(`${provider} does not support OAuth.`);

  const clientId = process.env[meta.clientIdEnvKey!] ?? '';
  const clientSecret = process.env[meta.clientSecretEnvKey!] ?? '';

  try {
    const response = await fetch(meta.oauth.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`[${provider}] OAuth token refresh failed:`, text);
      return { accessToken: '', refreshToken: '', expiresIn: 0, error: 'Failed to refresh token.' };
    }

    const data = await response.json() as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? refreshToken,
      expiresIn: data.expires_in,
    };
  } catch (err) {
    console.error(`[${provider}] OAuth token refresh error:`, err);
    return { accessToken: '', refreshToken: '', expiresIn: 0, error: 'Network error during token refresh.' };
  }
}
