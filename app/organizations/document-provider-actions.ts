'use server';

import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { getOrgRole, auditLog } from '@/lib/rbac';
import type {
  DocumentProvider,
  DocumentProviderConnectionStatus,
  DocumentConnectionStatus,
} from '@/lib/document-providers/types';
import { ALL_DOCUMENT_PROVIDERS } from '@/lib/document-providers/types';

// ── Helpers ──────────────────────────────────────────────────

function origin(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
}

// ── Read ─────────────────────────────────────────────────────

/**
 * Get connection status for all document providers for an organization.
 */
export async function getDocumentProviderConnections(orgId: string): Promise<{
  data?: DocumentProviderConnectionStatus[];
  error?: string;
}> {
  try {
    const { data: rows, error } = await supabase
      .from('document_provider_connections')
      .select('*')
      .eq('org_id', orgId)
      .neq('status', 'disconnected');

    if (error) {
      console.error('Supabase error:', error);
      return { error: 'Failed to load document connections.' };
    }

    const connectedMap = new Map(
      (rows ?? []).map((r: {
        provider: string;
        external_account_id: string;
        status: string;
        is_default: boolean;
      }) => [r.provider, r]),
    );

    const statuses: DocumentProviderConnectionStatus[] = ALL_DOCUMENT_PROVIDERS.map((provider) => {
      const row = connectedMap.get(provider);
      if (!row) {
        return {
          provider,
          connected: false,
          externalAccountId: null,
          isDefault: false,
        };
      }
      return {
        provider,
        connected: row.status === 'connected',
        externalAccountId: row.external_account_id,
        isDefault: row.is_default,
      };
    });

    return { data: statuses };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

// ── Connect (OAuth) ──────────────────────────────────────────

export async function connectDocumentProvider(
  orgId: string,
  userId: string,
  provider: DocumentProvider,
): Promise<{ url?: string; error?: string }> {
  if (!orgId) return { error: 'Organization ID is required.' };
  if (!userId) return { error: 'User not authenticated.' };

  const role = await getOrgRole(orgId, userId);
  if (role !== 'superadmin') return { error: 'Only superadmins can manage document connections.' };

  try {
    // Check for existing connection
    const { data: existing } = await supabase
      .from('document_provider_connections')
      .select('id, status')
      .eq('org_id', orgId)
      .eq('provider', provider)
      .single();

    if (existing && existing.status !== 'disconnected') {
      return { error: `A ${provider} connection already exists. Disconnect it first.` };
    }

    if (provider === 'docusign') {
      return connectDocuSign(orgId);
    }

    return { error: 'Unsupported document provider.' };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

async function connectDocuSign(
  orgId: string,
): Promise<{ url?: string; error?: string }> {
  if (!process.env.DOCUSIGN_INTEGRATION_KEY || !process.env.DOCUSIGN_SECRET_KEY) {
    return { error: 'DocuSign integration is not configured. Contact your administrator.' };
  }

  const state = Buffer.from(JSON.stringify({ orgId, ts: Date.now() })).toString('base64url');

  const authBase = process.env.NODE_ENV === 'production'
    ? 'https://account.docusign.com'
    : 'https://account-d.docusign.com';

  const redirectUri = `${origin()}/api/providers/docusign/callback`;

  const url = `${authBase}/oauth/auth?response_type=code&scope=signature&client_id=${encodeURIComponent(process.env.DOCUSIGN_INTEGRATION_KEY!)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;

  return { url };
}

// ── Disconnect ───────────────────────────────────────────────

export async function disconnectDocumentProvider(
  orgId: string,
  userId: string,
  provider: DocumentProvider,
): Promise<{ success?: boolean; error?: string }> {
  if (!orgId) return { error: 'Organization ID is required.' };
  if (!userId) return { error: 'User not authenticated.' };

  const role = await getOrgRole(orgId, userId);
  if (role !== 'superadmin') return { error: 'Only superadmins can manage document connections.' };

  try {
    const { data: row } = await supabase
      .from('document_provider_connections')
      .select('id, external_account_id, is_default')
      .eq('org_id', orgId)
      .eq('provider', provider)
      .neq('status', 'disconnected')
      .single();

    if (!row) return { error: `No ${provider} account is connected.` };

    await supabase
      .from('document_provider_connections')
      .update({
        status: 'disconnected' as DocumentConnectionStatus,
        is_default: false,
        access_token_enc: null,
        refresh_token_enc: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id);

    // If this was the default, promote the next connected provider
    if (row.is_default) {
      const { data: nextRow } = await supabase
        .from('document_provider_connections')
        .select('id')
        .eq('org_id', orgId)
        .eq('status', 'connected')
        .limit(1)
        .single();

      if (nextRow) {
        await supabase
          .from('document_provider_connections')
          .update({ is_default: true, updated_at: new Date().toISOString() })
          .eq('id', nextRow.id);
      }
    }

    await auditLog({
      orgId,
      actorId: userId,
      action: 'connections.document_disconnected',
      targetType: 'organization',
      targetId: orgId,
      metadata: { provider, accountId: row.external_account_id },
    });

    return { success: true };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

// ── Set Default ──────────────────────────────────────────────

export async function setDefaultDocumentProvider(
  orgId: string,
  userId: string,
  provider: DocumentProvider,
): Promise<{ success?: boolean; error?: string }> {
  if (!orgId) return { error: 'Organization ID is required.' };
  if (!userId) return { error: 'User not authenticated.' };

  const role = await getOrgRole(orgId, userId);
  if (role !== 'superadmin') return { error: 'Only superadmins can manage document connections.' };

  try {
    const { data: row } = await supabase
      .from('document_provider_connections')
      .select('id')
      .eq('org_id', orgId)
      .eq('provider', provider)
      .eq('status', 'connected')
      .single();

    if (!row) return { error: `${provider} must be connected before setting as default.` };

    // Clear existing default
    await supabase
      .from('document_provider_connections')
      .update({ is_default: false, updated_at: new Date().toISOString() })
      .eq('org_id', orgId)
      .eq('is_default', true);

    // Set new default
    await supabase
      .from('document_provider_connections')
      .update({ is_default: true, updated_at: new Date().toISOString() })
      .eq('id', row.id);

    await auditLog({
      orgId,
      actorId: userId,
      action: 'connections.document_default_changed',
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
