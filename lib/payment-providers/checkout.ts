import 'server-only';
import { supabaseAdmin } from '@/lib/supabase-admin';
import type { PaymentProvider } from '@/lib/payment-providers/types';

// ── Types ────────────────────────────────────────────────────

export type ProviderAccount = {
  provider: PaymentProvider;
  externalAccountId: string;
  accessToken: string | null;
  orgId: string;
};

export type CheckoutLineItem = {
  name: string;
  description: string | null;
  unitAmountCents: number;
  quantity: number;
  imageUrl: string | null;
};

export type CheckoutResult = {
  url: string;
  providerSessionId: string;
};

// ── Resolve default provider ────────────────────────────────

/**
 * Resolve the default payment provider for an org.
 * Returns the provider connection details including encrypted access token.
 */
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

  // Fallback: any connected provider (prefer Stripe for backward compat)
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

// ── Stripe checkout ─────────────────────────────────────────

async function createStripeCheckout(
  account: ProviderAccount,
  lineItems: CheckoutLineItem[],
  metadata: Record<string, string>,
  origin: string,
): Promise<CheckoutResult> {
  const { stripe } = await import('@/lib/stripe');

  // Verify the connected account is charges-enabled
  const stripeAccount = await stripe.accounts.retrieve(account.externalAccountId);
  if (!stripeAccount.charges_enabled) {
    throw new Error('Stripe account is not ready to accept payments.');
  }

  const stripeLineItems = lineItems.map((item) => ({
    price_data: {
      currency: 'usd',
      product_data: {
        name: item.name,
        description: item.description || undefined,
        ...(item.imageUrl ? { images: [item.imageUrl] } : {}),
      },
      unit_amount: item.unitAmountCents,
    },
    quantity: item.quantity,
  }));

  const session = await stripe.checkout.sessions.create(
    {
      mode: 'payment',
      line_items: stripeLineItems,
      metadata,
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: metadata.cancel_url ?? `${origin}/checkout/cancel`,
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
    },
    { stripeAccount: account.externalAccountId },
  );

  return {
    url: session.url!,
    providerSessionId: session.id,
  };
}

// ── Square checkout ─────────────────────────────────────────

async function createSquareCheckout(
  account: ProviderAccount,
  lineItems: CheckoutLineItem[],
  metadata: Record<string, string>,
  origin: string,
): Promise<CheckoutResult> {
  if (!account.accessToken) {
    throw new Error('Square access token not available.');
  }

  const { createMerchantSquareClient } = await import('@/lib/square');
  const { client } = createMerchantSquareClient(account.accessToken);
  const { randomUUID } = await import('crypto');

  // Square uses locationId — fetch merchant's main location
  const locResult = await client.locations.list();
  const locationId = locResult.locations?.[0]?.id;
  if (!locationId) {
    throw new Error('No Square location found for this merchant.');
  }

  const squareLineItems = lineItems.map((item) => ({
    name: item.name,
    quantity: String(item.quantity),
    basePriceMoney: {
      amount: BigInt(item.unitAmountCents),
      currency: 'USD' as const,
    },
  }));

  const result = await client.checkout.paymentLinks.create({
    idempotencyKey: randomUUID(),
    order: {
      locationId,
      referenceId: metadata.checkout_session_id ?? metadata.inventory_item_id ?? undefined,
      lineItems: squareLineItems,
    },
    checkoutOptions: {
      redirectUrl: `${origin}/checkout/success?provider=square&ref=${metadata.checkout_session_id ?? ''}`,
    },
  });

  const checkoutUrl = result.paymentLink?.url;
  const orderId = result.paymentLink?.orderId;

  if (!checkoutUrl) {
    throw new Error('Failed to create Square checkout link.');
  }

  return {
    url: checkoutUrl,
    providerSessionId: `sq_${orderId ?? result.paymentLink?.id ?? ''}`,
  };
}

// ── Clover checkout ─────────────────────────────────────────

async function createCloverCheckout(
  account: ProviderAccount,
  lineItems: CheckoutLineItem[],
  metadata: Record<string, string>,
  origin: string,
): Promise<CheckoutResult> {
  if (!account.accessToken) {
    throw new Error('Clover access token not available.');
  }

  const { cloverApi } = await import('@/lib/clover');
  const merchantId = account.externalAccountId;

  // Create a Clover order with line items
  const order = await cloverApi<{ id: string; total: number }>(
    `/v3/merchants/${merchantId}/orders`,
    {
      method: 'POST',
      token: account.accessToken,
      body: { state: 'open', total: 0 },
    },
  );

  // Add line items
  for (const item of lineItems) {
    await cloverApi(
      `/v3/merchants/${merchantId}/orders/${order.id}/line_items`,
      {
        method: 'POST',
        token: account.accessToken,
        body: {
          name: item.name,
          price: item.unitAmountCents,
          unitQty: item.quantity * 1000, // Clover uses 1/1000 units
        },
      },
    );
  }

  // For Clover, we'll redirect to a success page with the order reference
  // since Clover doesn't have a hosted checkout page like Stripe/Square.
  // The actual payment would be handled in-person via POS or through
  // the Clover ecommerce tokenization flow on a custom payment page.
  return {
    url: `${origin}/checkout/success?provider=clover&order=${order.id}`,
    providerSessionId: `clover_${order.id}`,
  };
}

// ── Dispatch ────────────────────────────────────────────────

/**
 * Create a checkout session using the org's default payment provider.
 */
export async function createProviderCheckout(
  account: ProviderAccount,
  lineItems: CheckoutLineItem[],
  metadata: Record<string, string>,
  origin: string,
): Promise<CheckoutResult> {
  switch (account.provider) {
    case 'stripe':
      return createStripeCheckout(account, lineItems, metadata, origin);
    case 'square':
      return createSquareCheckout(account, lineItems, metadata, origin);
    case 'clover':
      return createCloverCheckout(account, lineItems, metadata, origin);
    default:
      throw new Error(`Unsupported payment provider: ${account.provider}`);
  }
}
