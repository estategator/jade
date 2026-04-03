import 'server-only';
import type { ProviderAccount, PaymentStatusResult } from '@/lib/payment-providers/types';

export async function getSquarePaymentStatus(
  account: ProviderAccount,
  providerPaymentId: string,
): Promise<PaymentStatusResult> {
  if (!account.accessToken) {
    throw new Error('Square access token not available.');
  }

  const { createMerchantSquareClient } = await import('@/lib/square');
  const { client } = createMerchantSquareClient(account.accessToken);

  const response = await client.payments.get({ paymentId: providerPaymentId });
  const payment = response.payment!;

  let status: PaymentStatusResult['status'];
  switch (payment.status) {
    case 'COMPLETED':
      status = payment.refundedMoney?.amount ? 'refunded' : 'completed';
      break;
    case 'FAILED':
    case 'CANCELED':
      status = 'failed';
      break;
    default:
      status = 'pending';
  }

  return {
    status,
    providerPaymentId: payment.id!,
    amountCents: Number(payment.amountMoney?.amount ?? 0),
    currency: (payment.amountMoney?.currency ?? 'USD').toLowerCase(),
    metadata: { orderId: payment.orderId, referenceId: payment.referenceId },
  };
}
