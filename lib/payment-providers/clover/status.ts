import 'server-only';
import type { ProviderAccount, PaymentStatusResult } from '@/lib/payment-providers/types';

export async function getCloverPaymentStatus(
  account: ProviderAccount,
  providerPaymentId: string,
): Promise<PaymentStatusResult> {
  if (!account.accessToken) {
    throw new Error('Clover access token not available.');
  }

  const { cloverApi } = await import('@/lib/clover');
  const merchantId = account.externalAccountId;

  const payment = await cloverApi<{
    id: string;
    amount: number;
    result: string;
    refunds?: { elements?: Array<{ id: string }> };
  }>(
    `/v3/merchants/${merchantId}/payments/${providerPaymentId}`,
    { token: account.accessToken },
  );

  let status: PaymentStatusResult['status'];
  if (payment.refunds?.elements?.length) {
    status = 'refunded';
  } else if (payment.result === 'SUCCESS') {
    status = 'completed';
  } else if (payment.result === 'FAIL' || payment.result === 'DECLINED') {
    status = 'failed';
  } else {
    status = 'pending';
  }

  return {
    status,
    providerPaymentId: payment.id,
    amountCents: payment.amount,
    currency: 'usd',
    metadata: {},
  };
}
