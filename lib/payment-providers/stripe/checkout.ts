import 'server-only';
import type { ProviderAccount, CheckoutLineItem, CheckoutResult } from '@/lib/payment-providers/types';

export async function createStripeCheckout(
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
