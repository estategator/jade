import 'server-only';
import type { ProviderAccount, RefundInput, RefundResult } from '@/lib/payment-providers/types';

export async function refundStripePayment(
  account: ProviderAccount,
  input: RefundInput,
): Promise<RefundResult> {
  const { stripe } = await import('@/lib/stripe');

  const refund = await stripe.refunds.create(
    {
      payment_intent: input.providerPaymentId,
      ...(input.amountCents ? { amount: input.amountCents } : {}),
      ...(input.reason ? { reason: input.reason as 'duplicate' | 'fraudulent' | 'requested_by_customer' } : {}),
    },
    { stripeAccount: account.externalAccountId },
  );

  return {
    refundId: refund.id,
    status: refund.status === 'succeeded' ? 'succeeded' : refund.status === 'failed' ? 'failed' : 'pending',
    amountCents: refund.amount,
  };
}
