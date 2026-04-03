import { supabaseAdmin } from '@/lib/supabase-admin';
import { handleCallback } from '@vercel/queue';
import { createSaleNotifications } from '@/app/notifications/actions';
import { enqueue, TOPICS } from '@/lib/queue';
import { type InvoiceGenerationPayload } from '@/app/api/queues/invoice-generation/route';

export type CloverWebhookPayload = {
  eventType: string;
  merchantId: string;
  data: Record<string, unknown>;
};

// ── Helpers ─────────────────────────────────────────────────

async function enqueueInvoiceGeneration(payload: InvoiceGenerationPayload): Promise<void> {
  await enqueue(
    TOPICS.INVOICE_GENERATION,
    payload,
    async (data) => {
      const { createCheckoutInvoice } = await import('@/lib/checkout-invoice');
      const result = await createCheckoutInvoice(data);
      if (result.error) {
        throw new Error(`Invoice generation failed: ${result.error}`);
      }
      console.log('[clover-webhook-queue] invoice inline fallback SUCCESS:', result.data?.invoice_number);
    },
  );
}

// ── Event processing ────────────────────────────────────────

export async function processWebhookEvent(payload: CloverWebhookPayload): Promise<void> {
  const { eventType, merchantId, data } = payload;
  const startedAt = Date.now();

  console.log('[clover-webhook-queue] Processing event', {
    eventType,
    merchantId,
    timestamp: new Date(startedAt).toISOString(),
  });

  // Look up org by Clover merchant ID
  const { data: connection } = await supabaseAdmin
    .from('payment_provider_connections')
    .select('org_id')
    .eq('provider', 'clover')
    .eq('external_account_id', merchantId)
    .eq('status', 'connected')
    .single();

  if (!connection) {
    console.warn('[clover-webhook-queue] No org found for merchant:', merchantId);
    return;
  }

  const orgId = connection.org_id;

  switch (eventType) {
    case 'payment.created':
    case 'payment.completed': {
      const payment = data as Record<string, unknown>;
      const paymentId = (payment.id ?? payment.paymentId) as string | undefined;
      if (!paymentId) break;

      const amountCents = Number(payment.amount ?? 0);
      const amount = amountCents / 100;
      const currency = ((payment.currency ?? 'usd') as string).toLowerCase();
      const orderId = payment.orderId as string | undefined;

      // Idempotency: check if sale already exists
      const { data: existingSale } = await supabaseAdmin
        .from('sales')
        .select('id')
        .eq('payment_provider', 'clover')
        .eq('provider_payment_id', paymentId)
        .maybeSingle();

      if (existingSale) {
        console.log('[clover-webhook-queue] Sale already exists for payment:', paymentId);
        break;
      }

      // Check for linked internal checkout session
      let checkoutSessionId: string | null = null;
      if (orderId) {
        const { data: cs } = await supabaseAdmin
          .from('checkout_sessions')
          .select('id')
          .eq('payment_provider', 'clover')
          .eq('provider_session_id', orderId)
          .eq('org_id', orgId)
          .maybeSingle();
        checkoutSessionId = cs?.id ?? null;
      }

      if (checkoutSessionId) {
        const { data: sessionItems } = await supabaseAdmin
          .from('checkout_session_items')
          .select('inventory_item_id, quantity, unit_price')
          .eq('checkout_session_id', checkoutSessionId);

        if (sessionItems?.length) {
          const invoiceLines: Array<{
            inventory_item_id: string;
            item_name: string;
            item_category: string;
            item_description: string;
            quantity: number;
            unit_price: number;
          }> = [];

          for (const si of sessionItems) {
            const { data: currentItem } = await supabaseAdmin
              .from('inventory_items')
              .select('quantity, status, project_id, price, name, category, description')
              .eq('id', si.inventory_item_id)
              .single();

            if (!currentItem) continue;

            if (currentItem.status === 'reserved' && currentItem.quantity === 0) {
              await supabaseAdmin
                .from('inventory_items')
                .update({
                  status: 'sold',
                  sold_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                })
                .eq('id', si.inventory_item_id);
            }

            invoiceLines.push({
              inventory_item_id: si.inventory_item_id,
              item_name: currentItem.name ?? 'Unknown item',
              item_category: (currentItem as Record<string, unknown>).category as string ?? 'Uncategorized',
              item_description: (currentItem as Record<string, unknown>).description as string ?? '',
              quantity: si.quantity,
              unit_price: si.unit_price,
            });

            const { data: sale } = await supabaseAdmin.from('sales').insert({
              inventory_item_id: si.inventory_item_id,
              seller_org_id: orgId,
              buyer_email: null,
              amount: si.unit_price * si.quantity,
              quantity: si.quantity,
              unit_price: si.unit_price,
              currency,
              payment_provider: 'clover',
              provider_session_id: orderId ?? null,
              provider_payment_id: paymentId,
              provider_account_id: merchantId,
              status: 'completed',
            }).select('id').single();

            if (sale) {
              const itemLabel = si.quantity > 1
                ? `${currentItem.name ?? 'Unknown item'} (x${si.quantity})`
                : (currentItem.name ?? 'Unknown item');
              await createSaleNotifications({
                orgId,
                saleId: sale.id,
                itemName: itemLabel,
                amount: si.unit_price * si.quantity,
                currency,
                buyerEmail: null,
              });
            }
          }

          await supabaseAdmin
            .from('checkout_sessions')
            .update({ status: 'completed', updated_at: new Date().toISOString() })
            .eq('id', checkoutSessionId);

          if (invoiceLines.length > 0) {
            const { data: csRow } = await supabaseAdmin
              .from('checkout_sessions')
              .select('user_id')
              .eq('id', checkoutSessionId)
              .single();

            let createdBy = csRow?.user_id;
            if (!createdBy) {
              const { data: orgRow } = await supabaseAdmin
                .from('organizations')
                .select('created_by')
                .eq('id', orgId)
                .single();
              createdBy = orgRow?.created_by;
            }

            if (createdBy) {
              await enqueueInvoiceGeneration({
                orgId,
                projectId: null,
                stripeCheckoutSessionId: orderId ?? paymentId,
                buyerEmail: null,
                currency,
                createdBy,
                lines: invoiceLines,
              });
            }
          }

          console.log(`[clover-webhook-queue] Multi-item checkout completed: ${sessionItems.length} items`);
        }
      } else {
        // Simple payment
        const { data: sale } = await supabaseAdmin.from('sales').insert({
          inventory_item_id: null,
          seller_org_id: orgId,
          buyer_email: null,
          amount,
          quantity: 1,
          unit_price: amount,
          currency,
          payment_provider: 'clover',
          provider_session_id: orderId ?? null,
          provider_payment_id: paymentId,
          provider_account_id: merchantId,
          status: 'completed',
        }).select('id').single();

        if (sale) {
          await createSaleNotifications({
            orgId,
            saleId: sale.id,
            itemName: 'Clover payment',
            amount,
            currency,
            buyerEmail: null,
          });
        }

        console.log('[clover-webhook-queue] Simple payment recorded', { orgId, amount, currency });
      }
      break;
    }

    default:
      console.log('[clover-webhook-queue] Unhandled event type:', eventType);
  }

  console.log('[clover-webhook-queue] Event processing complete', {
    eventType,
    merchantId,
    durationMs: Date.now() - startedAt,
  });
}

export const POST = handleCallback(async (payload: CloverWebhookPayload) => {
  await processWebhookEvent(payload);
});
