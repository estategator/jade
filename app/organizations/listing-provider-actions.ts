'use server';

import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { getOrgRole, auditLog } from '@/lib/rbac';
import { validateCredentials } from '@/lib/listing-providers/estatesales-net';
import type {
  ListingProvider,
  ListingProviderConnectionStatus,
  ListingConnectionStatus,
} from '@/lib/listing-providers/types';
import { ALL_LISTING_PROVIDERS } from '@/lib/listing-providers/types';

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
      return { error: 'Failed to load listing connections.' };
    }

    const connectedMap = new Map(
      (rows ?? []).map((r: {
        provider: string;
        external_account_id: string;
        status: string;
        is_default: boolean;
        credentials_enc: Record<string, unknown> | null;
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
        };
      }
      return {
        provider,
        connected: row.status === 'connected',
        externalAccountId: row.external_account_id,
        isDefault: row.is_default,
        username: (row.credentials_enc as { username?: string })?.username ?? null,
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
    const { data: existing } = await supabase
      .from('listing_provider_connections')
      .select('id, status')
      .eq('org_id', orgId)
      .eq('provider', provider)
      .single();

    if (existing && existing.status !== 'disconnected') {
      return { error: `A ${provider} connection already exists. Disconnect it first.` };
    }

    if (provider === 'estatesales_net') {
      return connectEstateSalesNet(orgId, userId, credentials, existing?.id);
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
      return { error: 'Failed to save connection.' };
    }
  } else {
    const { error } = await supabase
      .from('listing_provider_connections')
      .insert(connectionData);

    if (error) {
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
    const { data: row } = await supabase
      .from('listing_provider_connections')
      .select('id, is_default')
      .eq('org_id', orgId)
      .eq('provider', provider)
      .neq('status', 'disconnected')
      .single();

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
    const { data: row } = await supabase
      .from('listing_provider_connections')
      .select('id')
      .eq('org_id', orgId)
      .eq('provider', provider)
      .eq('status', 'connected')
      .single();

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
