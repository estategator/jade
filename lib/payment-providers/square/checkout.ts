import 'server-only';
import type { ProviderAccount, CheckoutLineItem, CheckoutResult } from '@/lib/payment-providers/types';

export async function createSquareCheckout(
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
    providerSessionId: orderId ?? result.paymentLink?.id ?? '',
  };
}
