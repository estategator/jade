import { NextRequest, NextResponse } from 'next/server';
import { getContractAdapter, type ContractProvider } from '@/lib/onboarding-providers/contracts';
import { enqueue, TOPICS } from '@/lib/queue';
import {
  processContractWebhook,
  type ContractWebhookPayload,
} from '@/app/onboarding/actions';

const SUPPORTED_PROVIDERS: ContractProvider[] = ['docusign', 'dropbox_sign'];

export async function POST(req: NextRequest) {
  const provider = req.nextUrl.searchParams.get('provider') as ContractProvider | null;

  if (!provider || !SUPPORTED_PROVIDERS.includes(provider)) {
    return NextResponse.json({ error: 'Invalid or missing provider.' }, { status: 400 });
  }

  const body = await req.text();
  const headers: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });

  const adapter = getContractAdapter(provider);

  if (!adapter.verifyWebhookSignature(body, headers)) {
    console.error(`[contract-webhook] Invalid signature for provider: ${provider}`);
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 401 });
  }

  let rawPayload: Record<string, unknown>;
  try {
    rawPayload = JSON.parse(body) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const payload: ContractWebhookPayload = { provider, rawPayload };

  console.log(`[contract-webhook] Received ${provider} event, enqueuing.`);

  await enqueue(TOPICS.CONTRACT_WEBHOOK, payload, processContractWebhook);

  return NextResponse.json({ received: true });
}
