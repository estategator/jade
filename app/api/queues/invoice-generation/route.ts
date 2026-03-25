import { handleCallback } from '@vercel/queue';
import { createCheckoutInvoice, type CreateCheckoutInvoiceInput } from '@/lib/checkout-invoice';

export type InvoiceGenerationPayload = {
  orgId: string;
  projectId: string | null;
  stripeCheckoutSessionId: string;
  buyerEmail: string | null;
  currency: string;
  createdBy: string;
  lines: CreateCheckoutInvoiceInput['lines'];
};

async function handleInvoiceGeneration(payload: InvoiceGenerationPayload): Promise<void> {
  const { orgId, projectId, stripeCheckoutSessionId, buyerEmail, currency, createdBy, lines } = payload;

  if (!orgId || !stripeCheckoutSessionId || !lines.length) {
    console.error('[invoice-generation] Missing required fields:', { orgId, stripeCheckoutSessionId, lineCount: lines.length });
    return;
  }

  console.log('[invoice-generation] Processing:', { orgId, stripeCheckoutSessionId, lines: lines.length });

  const result = await createCheckoutInvoice({
    orgId,
    projectId,
    stripeCheckoutSessionId,
    buyerEmail,
    currency,
    createdBy,
    lines,
  });

  if (result.error) {
    console.error('[invoice-generation] Failed:', result.error);
    // Throw so Vercel Queue retries the job
    throw new Error(`Invoice generation failed: ${result.error}`);
  }

  console.log('[invoice-generation] SUCCESS:', result.data?.invoice_number);
}

export const POST = handleCallback(handleInvoiceGeneration, {
  visibilityTimeoutSeconds: 30,
});
