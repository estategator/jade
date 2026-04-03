import 'server-only';
import type { ProviderAccount, PaymentStatusResult } from '@/lib/payment-providers/types';

export async function getStripePaymentStatus(
  account: ProviderAccount,
  providerPaymentId: string,
): Promise<PaymentStatusResult> {
  const { stripe } = await import('@/lib/stripe');

  const pi = await stripe.paymentIntents.retrieve(
    providerPaymentId,
    { expand: ['latest_charge'] },
    { stripeAccount: account.externalAccountId },
  );

  let status: PaymentStatusResult['status'];
  if (pi.status === 'succeeded') {
    const charge = pi.latest_charge;
    const refunded = typeof charge === 'object' && charge?.refunded;
    status = refunded ? 'refunded' : 'completed';
  } else if (pi.status === 'canceled' || pi.status === 'requires_payment_method') {
    status = 'failed';
  } else {
    status = 'pending';
  }

  return {
    status,
    providerPaymentId: pi.id,
    amountCents: pi.amount,
    currency: pi.currency,
    metadata: pi.metadata ?? {},
  };
}
