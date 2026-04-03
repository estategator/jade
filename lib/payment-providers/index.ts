import 'server-only';
import { supabaseAdmin } from '@/lib/supabase-admin';
import type {
  PaymentProvider,
  ProviderAccount,
  CheckoutLineItem,
  CheckoutResult,
  RefundInput,
  RefundResult,
  PaymentStatusResult,
} from '@/lib/payment-providers/types';

// Re-export all types for single-import convenience
export type {
  PaymentProvider,
  ProviderAccount,
  CheckoutLineItem,
  CheckoutResult,
  RefundInput,
  RefundResult,
  PaymentStatusResult,
  ConnectionStatus,
  ProviderConnection,
  ProviderConnectionStatus,
  ProviderDisplayInfo,
} from '@/lib/payment-providers/types';

export {
  PROVIDER_DISPLAY,
  ALL_PROVIDERS,
} from '@/lib/payment-providers/types';

// ── Resolve default provider ────────────────────────────────

export async function resolveDefaultProvider(orgId: string): Promise<ProviderAccount | null> {
  // First try explicit default
  const { data: defaultRow } = await supabaseAdmin
    .from('payment_provider_connections')
    .select('provider, external_account_id, access_token_enc, org_id')
    .eq('org_id', orgId)
    .eq('status', 'connected')
    .eq('onboarding_complete', true)
    .eq('is_default', true)
    .single();

  if (defaultRow) {
    return {
      provider: defaultRow.provider as PaymentProvider,
      externalAccountId: defaultRow.external_account_id,
      accessToken: defaultRow.access_token_enc,
      orgId: defaultRow.org_id,
    };
  }

  // Fallback: any connected provider (order: clover < square < stripe)
  const { data: fallbackRow } = await supabaseAdmin
    .from('payment_provider_connections')
    .select('provider, external_account_id, access_token_enc, org_id')
    .eq('org_id', orgId)
    .eq('status', 'connected')
    .eq('onboarding_complete', true)
    .order('provider')
    .limit(1)
    .single();

  if (fallbackRow) {
    return {
      provider: fallbackRow.provider as PaymentProvider,
      externalAccountId: fallbackRow.external_account_id,
      accessToken: fallbackRow.access_token_enc,
      orgId: fallbackRow.org_id,
    };
  }

  return null;
}

// ── Checkout dispatch ───────────────────────────────────────

export async function createCheckout(
  account: ProviderAccount,
  lineItems: CheckoutLineItem[],
  metadata: Record<string, string>,
  origin: string,
): Promise<CheckoutResult> {
  switch (account.provider) {
    case 'stripe': {
      const { createStripeCheckout } = await import('@/lib/payment-providers/stripe/checkout');
      return createStripeCheckout(account, lineItems, metadata, origin);
    }
    case 'square': {
      const { createSquareCheckout } = await import('@/lib/payment-providers/square/checkout');
      return createSquareCheckout(account, lineItems, metadata, origin);
    }
    case 'clover': {
      const { createCloverCheckout } = await import('@/lib/payment-providers/clover/checkout');
      return createCloverCheckout(account, lineItems, metadata, origin);
    }
    default:
      throw new Error(`Unsupported payment provider: ${account.provider}`);
  }
}

// ── Refund dispatch ─────────────────────────────────────────

export async function refundPayment(
  account: ProviderAccount,
  input: RefundInput,
): Promise<RefundResult> {
  switch (account.provider) {
    case 'stripe': {
      const { refundStripePayment } = await import('@/lib/payment-providers/stripe/refund');
      return refundStripePayment(account, input);
    }
    case 'square': {
      const { refundSquarePayment } = await import('@/lib/payment-providers/square/refund');
      return refundSquarePayment(account, input);
    }
    case 'clover': {
      const { refundCloverPayment } = await import('@/lib/payment-providers/clover/refund');
      return refundCloverPayment(account, input);
    }
    default:
      throw new Error(`Unsupported payment provider: ${account.provider}`);
  }
}

// ── Payment status dispatch ─────────────────────────────────

export async function getPaymentStatus(
  account: ProviderAccount,
  providerPaymentId: string,
): Promise<PaymentStatusResult> {
  switch (account.provider) {
    case 'stripe': {
      const { getStripePaymentStatus } = await import('@/lib/payment-providers/stripe/status');
      return getStripePaymentStatus(account, providerPaymentId);
    }
    case 'square': {
      const { getSquarePaymentStatus } = await import('@/lib/payment-providers/square/status');
      return getSquarePaymentStatus(account, providerPaymentId);
    }
    case 'clover': {
      const { getCloverPaymentStatus } = await import('@/lib/payment-providers/clover/status');
      return getCloverPaymentStatus(account, providerPaymentId);
    }
    default:
      throw new Error(`Unsupported payment provider: ${account.provider}`);
  }
}
