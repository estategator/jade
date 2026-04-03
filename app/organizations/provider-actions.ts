'use server';

import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { getOrgRole, auditLog } from '@/lib/rbac';
import { stripe } from '@/lib/stripe';
import type { PaymentProvider, ProviderConnectionStatus, ConnectionStatus } from '@/lib/payment-providers/types';
import { ALL_PROVIDERS } from '@/lib/payment-providers/types';

// ── Helpers ──────────────────────────────────────────────────

function origin(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
}

// ── Read ─────────────────────────────────────────────────────

/**
 * Get connection status for all providers for an organization.
 */
export async function getProviderConnections(orgId: string): Promise<{
  data?: ProviderConnectionStatus[];
  error?: string;
}> {
  try {
    const { data: rows, error } = await supabase
      .from('payment_provider_connections')
      .select('*')
      .eq('org_id', orgId)
      .neq('status', 'disconnected');

    if (error) {
      console.error('Supabase error:', error);
      return { error: 'Failed to load provider connections.' };
    }

    const connectedMap = new Map(
      (rows ?? []).map((r: {
        provider: string;
        external_account_id: string;
        status: string;
        onboarding_complete: boolean;
        is_default: boolean;
        metadata: Record<string, unknown>;
      }) => [r.provider, r]),
    );

    const statuses: ProviderConnectionStatus[] = ALL_PROVIDERS.map((provider) => {
      const row = connectedMap.get(provider);
      if (!row) {
        return {
          provider,
          connected: false,
          onboardingComplete: false,
          externalAccountId: null,
          isDefault: false,
          requirements: null,
        };
      }
      return {
        provider,
        connected: true,
        onboardingComplete: row.onboarding_complete,
        externalAccountId: row.external_account_id,
        isDefault: row.is_default,
        requirements: (row.metadata as { requirements?: { currentlyDue: string[]; errors: string[] } })?.requirements ?? null,
      };
    });

    return { data: statuses };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

/**
 * Live-sync the connection status from provider API (called on settings page load).
 */
export async function syncProviderStatus(orgId: string, provider: PaymentProvider): Promise<{
  data?: ProviderConnectionStatus;
  error?: string;
}> {
  try {
    const { data: row } = await supabase
      .from('payment_provider_connections')
      .select('*')
      .eq('org_id', orgId)
      .eq('provider', provider)
      .neq('status', 'disconnected')
      .single();

    if (!row) {
      return {
        data: {
          provider,
          connected: false,
          onboardingComplete: false,
          externalAccountId: null,
          isDefault: false,
          requirements: null,
        },
      };
    }

    if (provider === 'stripe') {
      return syncStripeStatus(orgId, row);
    }

    // Square and Clover: simple connectivity check
    return {
      data: {
        provider,
        connected: true,
        onboardingComplete: row.onboarding_complete,
        externalAccountId: row.external_account_id,
        isDefault: row.is_default,
        requirements: null,
      },
    };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

async function syncStripeStatus(
  orgId: string,
  row: { external_account_id: string; onboarding_complete: boolean; is_default: boolean },
): Promise<{ data: ProviderConnectionStatus }> {
  const account = await stripe.accounts.retrieve(row.external_account_id);
  const chargesEnabled = account.charges_enabled ?? false;
  const currentlyDue = account.requirements?.currently_due ?? [];
  const errors = (account.requirements?.errors ?? []).map((e) => e.reason ?? e.code);

  const newStatus: ConnectionStatus = chargesEnabled ? 'connected' : 'incomplete';

  if (chargesEnabled !== row.onboarding_complete) {
    await supabase
      .from('payment_provider_connections')
      .update({
        onboarding_complete: chargesEnabled,
        status: newStatus,
        metadata: { requirements: currentlyDue.length > 0 || errors.length > 0 ? { currentlyDue, errors } : null },
        updated_at: new Date().toISOString(),
      })
      .eq('org_id', orgId)
      .eq('provider', 'stripe');
  }

  return {
    data: {
      provider: 'stripe',
      connected: true,
      onboardingComplete: chargesEnabled,
      externalAccountId: row.external_account_id,
      isDefault: row.is_default,
      requirements: currentlyDue.length > 0 || errors.length > 0 ? { currentlyDue, errors } : null,
    },
  };
}

// ── Connect ──────────────────────────────────────────────────

export async function connectProvider(
  orgId: string,
  userId: string,
  provider: PaymentProvider,
): Promise<{ url?: string; error?: string }> {
  if (!orgId) return { error: 'Organization ID is required.' };
  if (!userId) return { error: 'User not authenticated.' };

  const role = await getOrgRole(orgId, userId);
  if (role !== 'superadmin') return { error: 'Only superadmins can manage financial connections.' };

  try {
    // Check for existing connection
    const { data: existing } = await supabase
      .from('payment_provider_connections')
      .select('id, status')
      .eq('org_id', orgId)
      .eq('provider', provider)
      .single();

    if (existing && existing.status !== 'disconnected') {
      // Already has an active/pending/incomplete connection — block new connection
      return { error: `A ${provider} connection already exists. Disconnect it first before starting a new one.` };
    }

    if (provider === 'stripe') {
      return connectStripe(orgId, userId, existing?.id);
    }

    if (provider === 'square') {
      return connectSquare(orgId);
    }

    if (provider === 'clover') {
      return connectClover(orgId);
    }

    return { error: 'Unsupported provider.' };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

async function connectStripe(
  orgId: string,
  userId: string,
  existingRowId?: string,
): Promise<{ url?: string; error?: string }> {
  const account = await stripe.accounts.create({
    type: 'express',
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
  });

  const isFirst = await isFirstProvider(orgId);

  if (existingRowId) {
    await supabase
      .from('payment_provider_connections')
      .update({
        external_account_id: account.id,
        status: 'pending' as ConnectionStatus,
        onboarding_complete: false,
        is_default: isFirst,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingRowId);
  } else {
    await supabase.from('payment_provider_connections').insert({
      org_id: orgId,
      provider: 'stripe',
      external_account_id: account.id,
      status: 'pending' as ConnectionStatus,
      is_default: isFirst,
    });
  }

  await auditLog({
    orgId,
    actorId: userId,
    action: 'billing.provider_connected',
    targetType: 'organization',
    targetId: orgId,
    metadata: { provider: 'stripe', accountId: account.id },
  });

  const accountLink = await stripe.accountLinks.create({
    account: account.id,
    refresh_url: `${origin()}/organizations/${orgId}/providers/stripe/refresh`,
    return_url: `${origin()}/organizations/${orgId}/providers/stripe/return`,
    type: 'account_onboarding',
  });

  return { url: accountLink.url };
}

async function connectSquare(
  orgId: string,
): Promise<{ url?: string; error?: string }> {
  if (!process.env.SQUARE_APP_ID || !process.env.SQUARE_APP_SECRET) {
    return { error: 'Square integration is not configured.' };
  }

  // State encodes orgId for CSRF protection on callback
  const state = Buffer.from(JSON.stringify({ orgId, ts: Date.now() })).toString('base64url');

  const baseUrl = process.env.NODE_ENV === 'production'
    ? 'https://connect.squareup.com'
    : 'https://connect.squareupsandbox.com';

  const redirectUri = `${origin()}/api/providers/square/callback`;

  const url = `${baseUrl}/oauth2/authorize?client_id=${encodeURIComponent(process.env.SQUARE_APP_ID!)}&scope=MERCHANT_PROFILE_READ+PAYMENTS_READ+PAYMENTS_WRITE+ORDERS_READ+ORDERS_WRITE&session=false&state=${state}&redirect_uri=${encodeURIComponent(redirectUri)}`;

  return { url };
}

async function connectClover(
  orgId: string,
): Promise<{ url?: string; error?: string }> {
  if (!process.env.CLOVER_APP_ID || !process.env.CLOVER_APP_SECRET) {
    return { error: 'Clover integration is not configured.' };
  }

  const state = Buffer.from(JSON.stringify({ orgId, ts: Date.now() })).toString('base64url');

  const authBase = process.env.NODE_ENV === 'production'
    ? 'https://www.clover.com'
    : 'https://sandbox.dev.clover.com';

  const redirectUri = `${origin()}/api/providers/clover/callback`;

  const url = `${authBase}/oauth/v2/authorize?client_id=${encodeURIComponent(process.env.CLOVER_APP_ID!)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;

  return { url };
}

// ── Onboarding retry ─────────────────────────────────────────

export async function getOnboardingUrl(
  orgId: string,
  userId: string,
  provider: PaymentProvider,
): Promise<{ url?: string; error?: string }> {
  if (!orgId) return { error: 'Organization ID is required.' };
  if (!userId) return { error: 'User not authenticated.' };

  const role = await getOrgRole(orgId, userId);
  if (role !== 'superadmin') return { error: 'Only superadmins can manage financial connections.' };

  try {
    const { data: row } = await supabase
      .from('payment_provider_connections')
      .select('external_account_id, onboarding_complete')
      .eq('org_id', orgId)
      .eq('provider', provider)
      .neq('status', 'disconnected')
      .single();

    if (!row) return { error: `No ${provider} account found. Connect it first.` };

    if (provider === 'stripe') {
      if (row.onboarding_complete) return { error: 'Stripe onboarding is already complete.' };

      const accountLink = await stripe.accountLinks.create({
        account: row.external_account_id,
        refresh_url: `${origin()}/organizations/${orgId}/providers/stripe/refresh`,
        return_url: `${origin()}/organizations/${orgId}/providers/stripe/return`,
        type: 'account_onboarding',
      });
      return { url: accountLink.url };
    }

    // Square and Clover don't have multi-step onboarding — re-initiate OAuth
    return connectProvider(orgId, userId, provider);
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

// ── Disconnect ───────────────────────────────────────────────

export async function disconnectProvider(
  orgId: string,
  userId: string,
  provider: PaymentProvider,
): Promise<{ success?: boolean; error?: string }> {
  if (!orgId) return { error: 'Organization ID is required.' };
  if (!userId) return { error: 'User not authenticated.' };

  const role = await getOrgRole(orgId, userId);
  if (role !== 'superadmin') return { error: 'Only superadmins can manage financial connections.' };

  try {
    const { data: row } = await supabase
      .from('payment_provider_connections')
      .select('id, external_account_id, is_default')
      .eq('org_id', orgId)
      .eq('provider', provider)
      .neq('status', 'disconnected')
      .single();

    if (!row) return { error: `No ${provider} account is connected.` };

    await supabase
      .from('payment_provider_connections')
      .update({
        status: 'disconnected' as ConnectionStatus,
        is_default: false,
        access_token_enc: null,
        refresh_token_enc: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id);

    // If this was the default, promote the next connected provider
    if (row.is_default) {
      const { data: nextRow } = await supabase
        .from('payment_provider_connections')
        .select('id')
        .eq('org_id', orgId)
        .eq('status', 'connected')
        .limit(1)
        .single();

      if (nextRow) {
        await supabase
          .from('payment_provider_connections')
          .update({ is_default: true, updated_at: new Date().toISOString() })
          .eq('id', nextRow.id);
      }
    }

    await auditLog({
      orgId,
      actorId: userId,
      action: 'billing.provider_disconnected',
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

export async function setDefaultProvider(
  orgId: string,
  userId: string,
  provider: PaymentProvider,
): Promise<{ success?: boolean; error?: string }> {
  if (!orgId) return { error: 'Organization ID is required.' };
  if (!userId) return { error: 'User not authenticated.' };

  const role = await getOrgRole(orgId, userId);
  if (role !== 'superadmin') return { error: 'Only superadmins can manage financial connections.' };

  try {
    const { data: row } = await supabase
      .from('payment_provider_connections')
      .select('id, onboarding_complete')
      .eq('org_id', orgId)
      .eq('provider', provider)
      .eq('status', 'connected')
      .single();

    if (!row) return { error: `${provider} must be fully connected before setting as default.` };
    if (!row.onboarding_complete) return { error: `${provider} onboarding is incomplete.` };

    // Clear existing default
    await supabase
      .from('payment_provider_connections')
      .update({ is_default: false, updated_at: new Date().toISOString() })
      .eq('org_id', orgId)
      .eq('is_default', true);

    // Set new default
    await supabase
      .from('payment_provider_connections')
      .update({ is_default: true, updated_at: new Date().toISOString() })
      .eq('id', row.id);

    await auditLog({
      orgId,
      actorId: userId,
      action: 'billing.default_provider_changed',
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

async function isFirstProvider(orgId: string): Promise<boolean> {
  const { count } = await supabase
    .from('payment_provider_connections')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .neq('status', 'disconnected');
  return (count ?? 0) === 0;
}
