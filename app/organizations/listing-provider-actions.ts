'use server';

import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { getOrgRole, auditLog } from '@/lib/rbac';
import { validateCredentials } from '@/lib/listing-providers/estatesales-net';
import { heritageAuctionsAdapter } from '@/lib/listing-providers/heritage-auctions';
import { buildOAuthUrl, exchangeOAuthCode } from '@/lib/listing-providers/platform-metadata';
import { PLATFORM_METADATA } from '@/lib/listing-providers/platform-metadata';
import type {
  ListingProvider,
  ListingProviderConnectionStatus,
  ListingConnectionStatus,
  ListingSyncStatus,
} from '@/lib/listing-providers/types';
import { ALL_LISTING_PROVIDERS } from '@/lib/listing-providers/types';

const SCHEMA_MISSING_MSG =
  'Listing connections are not available yet. A database migration may be pending — please contact your administrator.';

function isSchemaMissing(error: { code?: string } | null): boolean {
  return error?.code === 'PGRST205';
}

// ── Read ─────────────────────────────────────────────────────

/**
 * Get connection status for all listing providers for an organization.
 */
export async function getListingProviderConnections(orgId: string): Promise<{
  data?: ListingProviderConnectionStatus[];
  error?: string;
}> {
  try {
    const { data: rows, error } = await supabase
      .from('listing_provider_connections')
      .select('*')
      .eq('org_id', orgId)
      .neq('status', 'disconnected');

    if (error) {
      console.error('Supabase error:', error);
      if (isSchemaMissing(error)) return { error: SCHEMA_MISSING_MSG };
      return { error: 'Failed to load listing connections.' };
    }

    const connectedMap = new Map(
      (rows ?? []).map((r: {
        provider: string;
        external_account_id: string;
        status: string;
        is_default: boolean;
        credentials_enc: Record<string, unknown> | null;
        sync_status: string | null;
        last_sync_at: string | null;
      }) => [r.provider, r]),
    );

    const statuses: ListingProviderConnectionStatus[] = ALL_LISTING_PROVIDERS.map((provider) => {
      const row = connectedMap.get(provider);
      if (!row) {
        return {
          provider,
          connected: false,
          externalAccountId: null,
          isDefault: false,
          username: null,
          syncStatus: null,
          lastSyncAt: null,
        };
      }
      return {
        provider,
        connected: row.status === 'connected',
        externalAccountId: row.external_account_id,
        isDefault: row.is_default,
        username: (row.credentials_enc as { username?: string })?.username ?? null,
        syncStatus: (row.sync_status as ListingSyncStatus) ?? null,
        lastSyncAt: row.last_sync_at ?? null,
      };
    });

    return { data: statuses };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

// ── Connect (manual credentials) ────────────────────────────

export async function connectListingProvider(
  orgId: string,
  userId: string,
  provider: ListingProvider,
  credentials: Record<string, string>,
): Promise<{ success?: boolean; error?: string }> {
  if (!orgId) return { error: 'Organization ID is required.' };
  if (!userId) return { error: 'User not authenticated.' };

  const role = await getOrgRole(orgId, userId);
  if (role !== 'superadmin') return { error: 'Only superadmins can manage listing connections.' };

  try {
    // Check for existing connection
    const { data: existing, error: existingError } = await supabase
      .from('listing_provider_connections')
      .select('id, status')
      .eq('org_id', orgId)
      .eq('provider', provider)
      .single();

    if (isSchemaMissing(existingError)) return { error: SCHEMA_MISSING_MSG };

    if (existing && existing.status !== 'disconnected') {
      return { error: `A ${provider} connection already exists. Disconnect it first.` };
    }

    if (provider === 'estatesales_net') {
      return connectEstateSalesNet(orgId, userId, credentials, existing?.id);
    }

    if (provider === 'heritage_auctions') {
      return connectHeritageAuctions(orgId, userId, credentials, existing?.id);
    }

    // OAuth providers (whatnot, etsy, ebay) are connected via OAuth callback,
    // not via direct credential submission.
    const meta = PLATFORM_METADATA[provider];
    if (meta.authType === 'oauth') {
      return { error: `${meta.displayName} requires OAuth connection. Use the "Connect" button to start the OAuth flow.` };
    }

    return { error: 'Unsupported listing provider.' };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

async function connectEstateSalesNet(
  orgId: string,
  userId: string,
  credentials: Record<string, string>,
  existingRowId?: string,
): Promise<{ success?: boolean; error?: string }> {
  const { username, api_key, organization_id } = credentials;

  if (!username || !api_key || !organization_id) {
    return { error: 'All fields are required: username, API key, and organization ID.' };
  }

  // Validate credentials against EstateSales.NET API
  const validation = await validateCredentials({
    username,
    apiKey: api_key,
    organizationId: organization_id,
  });

  if (!validation.valid) {
    return { error: validation.error ?? 'Invalid credentials.' };
  }

  const orgIdNumeric = organization_id.replace('#', '').trim();
  const isFirst = await isFirstListingProvider(orgId);

  const connectionData = {
    org_id: orgId,
    provider: 'estatesales_net' as const,
    external_account_id: orgIdNumeric,
    status: 'connected' as ListingConnectionStatus,
    is_default: isFirst,
    credentials_enc: { username, api_key, organization_id: orgIdNumeric },
    metadata: { companyName: validation.companyName ?? null },
    updated_at: new Date().toISOString(),
  };

  if (existingRowId) {
    const { error } = await supabase
      .from('listing_provider_connections')
      .update(connectionData)
      .eq('id', existingRowId);

    if (error) {
      console.error('Supabase error:', error);
      if (isSchemaMissing(error)) return { error: SCHEMA_MISSING_MSG };
      return { error: 'Failed to save connection.' };
    }
  } else {
    const { error } = await supabase
      .from('listing_provider_connections')
      .insert(connectionData);

    if (error) {
      if (isSchemaMissing(error)) return { error: SCHEMA_MISSING_MSG };
      if (error.code === '23505') {
        return { error: 'A connection for this provider already exists.' };
      }
      console.error('Supabase error:', error);
      return { error: 'Failed to save connection.' };
    }
  }

  await auditLog({
    orgId,
    actorId: userId,
    action: 'connections.listing_connected',
    targetType: 'organization',
    targetId: orgId,
    metadata: { provider: 'estatesales_net', organizationId: orgIdNumeric },
  });

  return { success: true };
}

// ── Disconnect ───────────────────────────────────────────────

export async function disconnectListingProvider(
  orgId: string,
  userId: string,
  provider: ListingProvider,
): Promise<{ success?: boolean; error?: string }> {
  if (!orgId) return { error: 'Organization ID is required.' };
  if (!userId) return { error: 'User not authenticated.' };

  const role = await getOrgRole(orgId, userId);
  if (role !== 'superadmin') return { error: 'Only superadmins can manage listing connections.' };

  try {
    const { data: row, error: rowError } = await supabase
      .from('listing_provider_connections')
      .select('id, is_default')
      .eq('org_id', orgId)
      .eq('provider', provider)
      .neq('status', 'disconnected')
      .single();

    if (isSchemaMissing(rowError)) return { error: SCHEMA_MISSING_MSG };
    if (!row) return { error: `No ${provider} account is connected.` };

    await supabase
      .from('listing_provider_connections')
      .update({
        status: 'disconnected' as ListingConnectionStatus,
        is_default: false,
        credentials_enc: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id);

    // If this was the default, promote the next connected provider
    if (row.is_default) {
      const { data: nextRow } = await supabase
        .from('listing_provider_connections')
        .select('id')
        .eq('org_id', orgId)
        .eq('status', 'connected')
        .limit(1)
        .single();

      if (nextRow) {
        await supabase
          .from('listing_provider_connections')
          .update({ is_default: true, updated_at: new Date().toISOString() })
          .eq('id', nextRow.id);
      }
    }

    await auditLog({
      orgId,
      actorId: userId,
      action: 'connections.listing_disconnected',
      targetType: 'organization',
      targetId: orgId,
      metadata: { provider },
    });

    return { success: true };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

// ── Set Default ──────────────────────────────────────────────

export async function setDefaultListingProvider(
  orgId: string,
  userId: string,
  provider: ListingProvider,
): Promise<{ success?: boolean; error?: string }> {
  if (!orgId) return { error: 'Organization ID is required.' };
  if (!userId) return { error: 'User not authenticated.' };

  const role = await getOrgRole(orgId, userId);
  if (role !== 'superadmin') return { error: 'Only superadmins can manage listing connections.' };

  try {
    const { data: row, error: rowError } = await supabase
      .from('listing_provider_connections')
      .select('id')
      .eq('org_id', orgId)
      .eq('provider', provider)
      .eq('status', 'connected')
      .single();

    if (isSchemaMissing(rowError)) return { error: SCHEMA_MISSING_MSG };
    if (!row) return { error: `${provider} must be connected before setting as default.` };

    // Clear existing default
    await supabase
      .from('listing_provider_connections')
      .update({ is_default: false, updated_at: new Date().toISOString() })
      .eq('org_id', orgId)
      .eq('is_default', true);

    // Set new default
    await supabase
      .from('listing_provider_connections')
      .update({ is_default: true, updated_at: new Date().toISOString() })
      .eq('id', row.id);

    await auditLog({
      orgId,
      actorId: userId,
      action: 'connections.listing_default_changed',
      targetType: 'organization',
      targetId: orgId,
      metadata: { provider },
    });

    return { success: true };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

// ── Internal Helpers ────────────────────────────────────────

async function isFirstListingProvider(orgId: string): Promise<boolean> {
  const { count } = await supabase
    .from('listing_provider_connections')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .neq('status', 'disconnected');
  return (count ?? 0) === 0;
}

// ── Heritage Auctions (API key) ─────────────────────────────

async function connectHeritageAuctions(
  orgId: string,
  userId: string,
  credentials: Record<string, string>,
  existingRowId?: string,
): Promise<{ success?: boolean; error?: string }> {
  const { api_key, account_id } = credentials;

  if (!api_key || !account_id) {
    return { error: 'API key and account ID are required.' };
  }

  const validation = await heritageAuctionsAdapter.validateConnection(credentials);
  if (!validation.valid) {
    return { error: validation.error ?? 'Invalid credentials.' };
  }

  const isFirst = await isFirstListingProvider(orgId);

  const connectionData = {
    org_id: orgId,
    provider: 'heritage_auctions' as const,
    external_account_id: account_id,
    status: 'connected' as ListingConnectionStatus,
    auth_type: 'api_key' as const,
    is_default: isFirst,
    credentials_enc: { api_key, account_id },
    metadata: {},
    updated_at: new Date().toISOString(),
  };

  if (existingRowId) {
    const { error } = await supabase
      .from('listing_provider_connections')
      .update(connectionData)
      .eq('id', existingRowId);

    if (error) {
      console.error('Supabase error:', error);
      return { error: 'Failed to save connection.' };
    }
  } else {
    const { error } = await supabase
      .from('listing_provider_connections')
      .insert(connectionData);

    if (error) {
      if (error.code === '23505') return { error: 'A connection for this provider already exists.' };
      console.error('Supabase error:', error);
      return { error: 'Failed to save connection.' };
    }
  }

  await auditLog({
    orgId,
    actorId: userId,
    action: 'connections.listing_connected',
    targetType: 'organization',
    targetId: orgId,
    metadata: { provider: 'heritage_auctions', accountId: account_id },
  });

  return { success: true };
}

// ── OAuth Connect (Whatnot, Etsy, eBay) ─────────────────────

const OAUTH_PROVIDERS: ListingProvider[] = ['whatnot', 'etsy', 'ebay'];

/**
 * Generate an OAuth authorization URL for a listing provider.
 * The user will be redirected to the provider to authorize, then
 * back to our callback URL which calls `completeOAuthConnection`.
 */
export async function getListingOAuthUrl(
  orgId: string,
  userId: string,
  provider: ListingProvider,
): Promise<{ url?: string; error?: string }> {
  if (!OAUTH_PROVIDERS.includes(provider)) {
    return { error: `${provider} does not support OAuth.` };
  }

  const role = await getOrgRole(orgId, userId);
  if (role !== 'superadmin') return { error: 'Only superadmins can manage listing connections.' };

  // Generate CSRF state token: orgId:provider:random
  const stateRandom = crypto.randomUUID();
  const state = `${orgId}:${provider}:${stateRandom}`;

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000';
  const redirectUri = `${baseUrl}/organizations/${orgId}/providers/listing/${provider}/return`;

  const url = buildOAuthUrl(provider, orgId, state, redirectUri);
  return { url };
}

/**
 * Complete an OAuth connection after the user returns from the provider.
 * Exchanges the auth code for tokens and stores the connection.
 */
export async function completeOAuthConnection(
  orgId: string,
  userId: string,
  provider: ListingProvider,
  code: string,
  state: string,
): Promise<{ success?: boolean; error?: string }> {
  if (!OAUTH_PROVIDERS.includes(provider)) {
    return { error: `${provider} does not support OAuth.` };
  }

  const role = await getOrgRole(orgId, userId);
  if (role !== 'superadmin') return { error: 'Only superadmins can manage listing connections.' };

  // Validate state contains the correct orgId and provider
  const [stateOrgId, stateProvider] = state.split(':');
  if (stateOrgId !== orgId || stateProvider !== provider) {
    return { error: 'Invalid OAuth state. Please try connecting again.' };
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000';
  const redirectUri = `${baseUrl}/organizations/${orgId}/providers/listing/${provider}/return`;

  const tokenResult = await exchangeOAuthCode(provider, code, redirectUri);
  if (tokenResult.error) {
    return { error: tokenResult.error };
  }

  try {
    const { data: existing } = await supabase
      .from('listing_provider_connections')
      .select('id, status')
      .eq('org_id', orgId)
      .eq('provider', provider)
      .single();

    const isFirst = await isFirstListingProvider(orgId);

    const connectionData = {
      org_id: orgId,
      provider,
      external_account_id: provider, // Will be updated once we fetch the user profile
      status: 'connected' as ListingConnectionStatus,
      auth_type: 'oauth' as const,
      is_default: isFirst,
      access_token_enc: tokenResult.accessToken,
      refresh_token_enc: tokenResult.refreshToken,
      token_expires_at: new Date(Date.now() + tokenResult.expiresIn * 1000).toISOString(),
      credentials_enc: null,
      metadata: {},
      updated_at: new Date().toISOString(),
    };

    if (existing && existing.status !== 'disconnected') {
      const { error } = await supabase
        .from('listing_provider_connections')
        .update(connectionData)
        .eq('id', existing.id);

      if (error) {
        console.error('Supabase error:', error);
        return { error: 'Failed to save connection.' };
      }
    } else if (existing) {
      // Re-enable disconnected connection
      const { error } = await supabase
        .from('listing_provider_connections')
        .update(connectionData)
        .eq('id', existing.id);

      if (error) {
        console.error('Supabase error:', error);
        return { error: 'Failed to save connection.' };
      }
    } else {
      const { error } = await supabase
        .from('listing_provider_connections')
        .insert(connectionData);

      if (error) {
        if (error.code === '23505') return { error: 'A connection for this provider already exists.' };
        console.error('Supabase error:', error);
        return { error: 'Failed to save connection.' };
      }
    }

    await auditLog({
      orgId,
      actorId: userId,
      action: 'connections.listing_connected',
      targetType: 'organization',
      targetId: orgId,
      metadata: { provider },
    });

    return { success: true };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}
