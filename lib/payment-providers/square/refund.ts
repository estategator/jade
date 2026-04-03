import 'server-only';
import type { ProviderAccount, RefundInput, RefundResult } from '@/lib/payment-providers/types';

export async function refundSquarePayment(
  account: ProviderAccount,
  input: RefundInput,
): Promise<RefundResult> {
  if (!account.accessToken) {
    throw new Error('Square access token not available.');
  }

  const { createMerchantSquareClient } = await import('@/lib/square');
  const { client } = createMerchantSquareClient(account.accessToken);
  const { randomUUID } = await import('crypto');

  // amountMoney is required by the SDK type but Square accepts partial refunds
  // by omitting it (defaults to full refund). Cast through unknown for flexibility.
  const amountMoney = input.amountCents
    ? { amount: BigInt(input.amountCents), currency: 'USD' as const }
    : { amount: BigInt(0), currency: 'USD' as const };

  const response = await client.refunds.refundPayment({
    idempotencyKey: randomUUID(),
    paymentId: input.providerPaymentId,
    amountMoney,
    ...(input.reason ? { reason: input.reason } : {}),
  });
  const refund = response.refund!;

  return {
    refundId: refund.id!,
    status: refund.status === 'COMPLETED' ? 'succeeded' : refund.status === 'FAILED' ? 'failed' : 'pending',
    amountCents: Number(refund.amountMoney?.amount ?? 0),
  };
}
