import 'server-only';
import type { ProviderAccount, RefundInput, RefundResult } from '@/lib/payment-providers/types';

const CLOVER_ECOMM_BASE = process.env.NODE_ENV === 'production'
  ? 'https://scl.clover.com'
  : 'https://scl-sandbox.dev.clover.com';

export async function refundCloverPayment(
  account: ProviderAccount,
  input: RefundInput,
): Promise<RefundResult> {
  if (!account.accessToken) {
    throw new Error('Clover access token not available.');
  }

  const { CloverApiError } = await import('@/lib/clover');

  const body: Record<string, unknown> = { charge: input.providerPaymentId };
  if (input.amountCents) {
    body.amount = input.amountCents;
  }

  const res = await fetch(`${CLOVER_ECOMM_BASE}/v1/refunds`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${account.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new CloverApiError(res.status, errorBody);
  }

  const data = await res.json();

  return {
    refundId: data.id ?? 'unknown',
    status: data.status === 'succeeded' ? 'succeeded' : data.status === 'failed' ? 'failed' : 'pending',
    amountCents: data.amount ?? input.amountCents ?? 0,
  };
}
