import { supabaseAdmin } from '@/lib/supabase-admin';
import { handleCallback } from '@vercel/queue';
import { createSaleNotifications } from '@/app/notifications/actions';
import { enqueue, TOPICS } from '@/lib/queue';
import { type InvoiceGenerationPayload } from '@/app/api/queues/invoice-generation/route';

export type SquareWebhookPayload = {
  eventType: string;
  eventId: string;
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
      console.log('[square-webhook-queue] invoice inline fallback SUCCESS:', result.data?.invoice_number);
    },
  );
}

// ── Event processing ────────────────────────────────────────

export async function processWebhookEvent(payload: SquareWebhookPayload): Promise<void> {
  const { eventType, eventId, merchantId, data } = payload;
  const startedAt = Date.now();

  console.log('[square-webhook-queue] Processing event', {
    eventType,
    eventId,
    merchantId,
    timestamp: new Date(startedAt).toISOString(),
  });

  // Look up org by Square merchant ID
  const { data: connection } = await supabaseAdmin
    .from('payment_provider_connections')
    .select('org_id')
    .eq('provider', 'square')
    .eq('external_account_id', merchantId)
    .eq('status', 'connected')
    .single();

  if (!connection) {
    console.warn('[square-webhook-queue] No org found for merchant:', merchantId);
    return;
  }

  const orgId = connection.org_id;

  switch (eventType) {
    case 'payment.completed': {
      const payment = (data as { object?: { payment?: Record<string, unknown> } })?.object?.payment;
      if (!payment) break;

      const paymentId = payment.id as string;
      const orderId = payment.order_id as string | undefined;
      const amountMoney = payment.amount_money as { amount?: number; currency?: string } | undefined;
      const amountCents = Number(amountMoney?.amount ?? 0);
      const currency = (amountMoney?.currency ?? 'USD').toLowerCase();
      const amount = amountCents / 100;
      const buyerEmail = (payment.buyer_email_address as string) ?? null;

      // Idempotency: check if sale already exists for this payment
      const { data: existingSale } = await supabaseAdmin
        .from('sales')
        .select('id')
        .eq('payment_provider', 'square')
        .eq('provider_payment_id', paymentId)
        .maybeSingle();

      if (existingSale) {
        console.log('[square-webhook-queue] Sale already exists for payment:', paymentId);
        break;
      }

      // If there's a checkout session linked, process line items
      let checkoutSessionId: string | null = null;
      if (orderId) {
        const { data: cs } = await supabaseAdmin
          .from('checkout_sessions')
          .select('id')
          .eq('payment_provider', 'square')
          .eq('provider_session_id', orderId)
          .eq('org_id', orgId)
          .maybeSingle();
        checkoutSessionId = cs?.id ?? null;
      }

      if (checkoutSessionId) {
        // Multi-item checkout via internal checkout session
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

            // Mark sold if reserved and quantity is 0
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

            // Insert sale record
            const { data: sale } = await supabaseAdmin.from('sales').insert({
              inventory_item_id: si.inventory_item_id,
              seller_org_id: orgId,
              buyer_email: buyerEmail,
              amount: si.unit_price * si.quantity,
              quantity: si.quantity,
              unit_price: si.unit_price,
              currency,
              payment_provider: 'square',
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
                buyerEmail,
              });
            }
          }

          // Mark checkout session completed
          await supabaseAdmin
            .from('checkout_sessions')
            .update({ status: 'completed', updated_at: new Date().toISOString() })
            .eq('id', checkoutSessionId);

          // Invoice generation
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
                buyerEmail,
                currency,
                createdBy,
                lines: invoiceLines,
              });
            }
          }

          console.log(`[square-webhook-queue] Multi-item checkout completed: ${sessionItems.length} items`);
        }
      } else {
        // Simple payment without internal checkout session
        const { data: sale } = await supabaseAdmin.from('sales').insert({
          inventory_item_id: null,
          seller_org_id: orgId,
          buyer_email: buyerEmail,
          amount,
          quantity: 1,
          unit_price: amount,
          currency,
          payment_provider: 'square',
          provider_session_id: orderId ?? null,
          provider_payment_id: paymentId,
          provider_account_id: merchantId,
          status: 'completed',
        }).select('id').single();

        if (sale) {
          await createSaleNotifications({
            orgId,
            saleId: sale.id,
            itemName: 'Square payment',
            amount,
            currency,
            buyerEmail,
          });
        }

        console.log('[square-webhook-queue] Simple payment recorded for org:', orgId);
      }
      break;
    }

    case 'payment.updated': {
      const payment = (data as { object?: { payment?: Record<string, unknown> } })?.object?.payment;
      if (!payment) break;
      console.log('[square-webhook-queue] Payment updated:', payment.id, 'status:', payment.status);
      break;
    }

    default:
      console.log('[square-webhook-queue] Unhandled event type:', eventType);
  }

  console.log('[square-webhook-queue] Event processing complete', {
    eventType,
    eventId,
    merchantId,
    durationMs: Date.now() - startedAt,
  });
}

export const POST = handleCallback(async (payload: SquareWebhookPayload) => {
  await processWebhookEvent(payload);
});
