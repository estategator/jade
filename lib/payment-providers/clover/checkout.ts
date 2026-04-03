import 'server-only';
import type { ProviderAccount, CheckoutLineItem, CheckoutResult } from '@/lib/payment-providers/types';

export async function createCloverCheckout(
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

  // Clover doesn't have a hosted checkout page like Stripe/Square.
  // Redirect to a success page with the order reference.
  return {
    url: `${origin}/checkout/success?provider=clover&order=${order.id}`,
    providerSessionId: `clover_${order.id}`,
  };
}
