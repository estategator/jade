import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import Stripe from 'stripe';
import { tierFromStripePriceId } from '@/lib/tiers';
import { handleCallback } from '@vercel/queue';
import { createSaleNotifications } from '@/app/notifications/actions';
import { restoreCheckoutSession, restoreSingleItem } from '@/app/api/checkout/cancel/route';
import { enqueue, TOPICS } from '@/lib/queue';
import { type InvoiceGenerationPayload } from '@/app/api/queues/invoice-generation/route';

export type WebhookPayload = {
  eventType: string;
  eventId: string;
  data: Record<string, unknown>;
  /** Present for v2 thin events — contains a reference, not the full object. */
  relatedObject?: {
    id: string;
    type: string;
    url: string;
  };
};

// ── Helpers ─────────────────────────────────────────────────

/** Derive the active price ID from a Stripe Subscription object. */
function activePriceId(sub: Stripe.Subscription): string | null {
  return sub.items?.data?.[0]?.price?.id ?? null;
}

/** Map a Stripe subscription status to the internal tier based on price, with fallback. */
function deriveTier(sub: Stripe.Subscription, fallbackTier?: string): 'free' | 'pro' | 'enterprise' {
  const priceId = activePriceId(sub);
  if (priceId) {
    const mapped = tierFromStripePriceId(priceId);
    if (mapped) return mapped;
  }
  // Fallback to metadata written during checkout
  if (fallbackTier === 'pro' || fallbackTier === 'enterprise') return fallbackTier;
  return 'free';
}

/** Resolve the org_id for a Stripe subscription, checking metadata then DB lookup. */
async function resolveOrgId(sub: Stripe.Subscription): Promise<string | undefined> {
  if (sub.metadata?.org_id) return sub.metadata.org_id;
  const { data: row } = await supabaseAdmin
    .from('subscriptions')
    .select('org_id')
    .eq('stripe_subscription_id', sub.id)
    .single();
  return row?.org_id;
}

/** Sync Stripe subscription state to subscriptions table. */
async function syncSubscriptionToOrg(sub: Stripe.Subscription, opts?: { clear?: boolean }) {
  const clear = opts?.clear ?? false;
  const orgId = await resolveOrgId(sub);
  if (!orgId) return;

  if (clear) {
    console.log('[stripe-webhook-queue] Clearing subscription for org:', orgId);
    const { error } = await supabaseAdmin
      .from('subscriptions')
      .update({
        tier: 'free',
        status: 'none',
        stripe_subscription_id: null,
        stripe_price_id: null,
        cancel_at_period_end: false,
        current_period_end: null,
        updated_at: new Date().toISOString(),
      })
      .eq('org_id', orgId);
    if (error) console.error('clear_subscription failed:', error);
    return;
  }

  const tier = deriveTier(sub, sub.metadata?.tier);
  const periodEnd = sub.cancel_at
    ? new Date(sub.cancel_at * 1000).toISOString()
    : null;
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id ?? null;

  const { error } = await supabaseAdmin
    .from('subscriptions')
    .upsert(
      {
        org_id: orgId,
        tier,
        status: sub.status ?? 'none',
        stripe_subscription_id: sub.id,
        stripe_customer_id: customerId,
        stripe_price_id: activePriceId(sub),
        cancel_at_period_end: sub.cancel_at_period_end ?? false,
        current_period_end: periodEnd,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'org_id' }
    );
  if (error) console.error('[stripe-webhook-queue] sync_subscription FAILED:', error);
  else console.log('[stripe-webhook-queue] sync_subscription SUCCESS for org:', orgId, 'tier:', tier);
}

// ── Invoice line type (shared with invoice-generation queue) ─

type InvoiceLineInput = {
  inventory_item_id: string;
  item_name: string;
  item_category: string;
  item_description: string;
  quantity: number;
  unit_price: number;
};

/**
 * Enqueue an invoice generation job.
 *
 * The actual creation is handled by the invoice-generation queue
 * processor, which calls `createCheckoutInvoice` from `lib/checkout-invoice.ts`.
 * Local dev falls back to inline processing via the shared `enqueue` helper.
 */
async function enqueueInvoiceGeneration(payload: InvoiceGenerationPayload): Promise<void> {
  await enqueue(
    TOPICS.INVOICE_GENERATION,
    payload,
    async (data) => {
      // Inline fallback for local dev / queue send failures
      const { createCheckoutInvoice } = await import('@/lib/checkout-invoice');
      const result = await createCheckoutInvoice(data);
      if (result.error) {
        throw new Error(`Invoice generation failed: ${result.error}`);
      }
      console.log('[invoice-generation] inline fallback SUCCESS:', result.data?.invoice_number);
    },
  );
}

// ── Event processing ────────────────────────────────────────

export async function processWebhookEvent(payload: WebhookPayload): Promise<void> {
  const { eventType, data } = payload;
  const startedAt = Date.now();

  console.log('[stripe-webhook-queue] Processing event', {
    eventType,
    eventId: payload.eventId,
    hasRelatedObject: !!payload.relatedObject,
    timestamp: new Date(startedAt).toISOString(),
  });

  switch (eventType) {
    case 'checkout.session.completed': {
      const session = data as unknown as Stripe.Checkout.Session;

      console.log('[stripe-webhook-queue] checkout.session.completed', {
        sessionId: session.id,
        mode: session.mode,
        paymentIntent: session.payment_intent,
        customerEmail: session.customer_details?.email,
        amountTotal: session.amount_total,
        currency: session.currency,
        metadata: session.metadata,
      });

      // Handle subscription checkout
      if (session.mode === 'subscription') {
        const orgId = session.metadata?.org_id;
        const tier = session.metadata?.tier as 'pro' | 'enterprise' | undefined;
        const subscriptionId = session.subscription as string | null;
        const customerId = typeof session.customer === 'string' ? session.customer : null;
        if (orgId && tier) {
          console.log('[stripe-webhook-queue] checkout.session.completed: upserting subscription', { orgId, tier, subscriptionId, customerId });
          const { error } = await supabaseAdmin
            .from('subscriptions')
            .upsert(
              {
                org_id: orgId,
                tier,
                status: 'active',
                stripe_subscription_id: subscriptionId,
                stripe_customer_id: customerId,
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'org_id' }
            );
          if (error) console.error('[stripe-webhook-queue] upsert_subscription_from_checkout FAILED:', error);
          else console.log('[stripe-webhook-queue] upsert_subscription_from_checkout SUCCESS for org:', orgId);
        }
        break;
      }

      const itemId = session.metadata?.inventory_item_id;
      const checkoutSessionId = session.metadata?.checkout_session_id;
      const connectedAccountId = session.metadata?.connected_account_id;

      if (checkoutSessionId) {
        // ── Multi-item checkout via cart ──
        // Parallel: fetch session items + checkout session user_id (saves a later round trip)
        const [{ data: sessionItems }, { data: csRow }] = await Promise.all([
          supabaseAdmin
            .from('checkout_session_items')
            .select('inventory_item_id, quantity, unit_price, reserved_quantity')
            .eq('checkout_session_id', checkoutSessionId),
          supabaseAdmin
            .from('checkout_sessions')
            .select('user_id')
            .eq('id', checkoutSessionId)
            .single(),
        ]);

        if (sessionItems?.length) {
          // Batch-fetch all inventory items in one query (replaces N sequential fetches)
          const itemIds = sessionItems.map(si => si.inventory_item_id);
          const { data: allItems } = await supabaseAdmin
            .from('inventory_items')
            .select('id, quantity, status, project_id, price, name, category, description')
            .in('id', itemIds);

          const itemMap = new Map((allItems ?? []).map(i => [i.id, i]));

          // Batch-fetch all projects in one query (replaces N sequential fetches)
          const projectIds = [...new Set(
            (allItems ?? []).filter(i => i.project_id).map(i => i.project_id as string)
          )];
          const { data: allProjects } = projectIds.length
            ? await supabaseAdmin.from('projects').select('id, org_id').in('id', projectIds)
            : { data: [] as { id: string; org_id: string }[] };
          const projectMap = new Map((allProjects ?? []).map(p => [p.id, p.org_id]));

          let firstOrgId: string | null = null;
          let firstProjectId: string | null = null;
          const invoiceLines: InvoiceLineInput[] = [];

          // Process each item: parallelize inventory update + sale insert per item
          const results = await Promise.all(sessionItems.map(async (si) => {
            const currentItem = itemMap.get(si.inventory_item_id);
            if (!currentItem) return null;

            const updatePayload = currentItem.status === 'reserved' && currentItem.quantity === 0
              ? {
                  status: 'sold' as const,
                  stripe_payment_id: session.payment_intent as string,
                  sold_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                }
              : {
                  stripe_payment_id: session.payment_intent as string,
                  updated_at: new Date().toISOString(),
                };

            const orgId = projectMap.get(currentItem.project_id) ?? null;

            // Parallel: update inventory + insert sale (independent writes)
            const [, { data: sale }] = await Promise.all([
              supabaseAdmin
                .from('inventory_items')
                .update(updatePayload)
                .eq('id', si.inventory_item_id),
              supabaseAdmin.from('sales').insert({
                inventory_item_id: si.inventory_item_id,
                seller_org_id: orgId,
                buyer_email: session.customer_details?.email ?? null,
                amount: si.unit_price * si.quantity,
                quantity: si.quantity,
                unit_price: si.unit_price,
                currency: session.currency ?? 'usd',
                payment_provider: 'stripe',
                provider_session_id: session.id,
                provider_payment_id: session.payment_intent as string,
                provider_account_id: connectedAccountId ?? null,
                status: 'completed',
              }).select('id').single(),
            ]);

            return { si, currentItem, orgId, sale };
          }));

          // Post-process: collect invoice lines, send notifications, track org/project
          let totalNotified = 0;
          for (const result of results) {
            if (!result) continue;
            const { si, currentItem, orgId, sale } = result;

            if (!firstOrgId && orgId) firstOrgId = orgId;
            if (!firstProjectId && currentItem.project_id) firstProjectId = currentItem.project_id;

            invoiceLines.push({
              inventory_item_id: si.inventory_item_id,
              item_name: currentItem.name ?? 'Unknown item',
              item_category: (currentItem as Record<string, unknown>).category as string ?? 'Uncategorized',
              item_description: (currentItem as Record<string, unknown>).description as string ?? '',
              quantity: si.quantity,
              unit_price: si.unit_price,
            });

            if (sale && orgId) {
              const itemLabel = si.quantity > 1
                ? `${currentItem.name ?? 'Unknown item'} (x${si.quantity})`
                : (currentItem.name ?? 'Unknown item');
              await createSaleNotifications({
                orgId,
                saleId: sale.id,
                itemName: itemLabel,
                amount: si.unit_price * si.quantity,
                currency: session.currency ?? 'usd',
                buyerEmail: session.customer_details?.email ?? null,
              });
              totalNotified++;
            }
          }

          // Mark checkout session as completed
          await supabaseAdmin
            .from('checkout_sessions')
            .update({ status: 'completed', updated_at: new Date().toISOString() })
            .eq('id', checkoutSessionId);

          console.log(`[stripe-webhook-queue] Multi-item checkout completed`, {
            sessionId: session.id,
            itemCount: sessionItems.length,
            notificationsSent: totalNotified,
            durationMs: Date.now() - startedAt,
          });

          // Enqueue invoice generation for the completed checkout
          if (firstOrgId && invoiceLines.length > 0) {
            // csRow was fetched in parallel above — no extra round trip
            let invoiceCreatedBy = csRow?.user_id;
            if (!invoiceCreatedBy) {
              const { data: orgRow } = await supabaseAdmin
                .from('organizations')
                .select('created_by')
                .eq('id', firstOrgId)
                .single();
              invoiceCreatedBy = orgRow?.created_by;
            }

            if (invoiceCreatedBy) {
              await enqueueInvoiceGeneration({
                orgId: firstOrgId,
                projectId: firstProjectId,
                stripeCheckoutSessionId: session.id,
                buyerEmail: session.customer_details?.email ?? null,
                currency: session.currency ?? 'usd',
                createdBy: invoiceCreatedBy,
                lines: invoiceLines,
              });
              console.log('[stripe-webhook-queue] Invoice generation enqueued', {
                sessionId: session.id,
                orgId: firstOrgId,
                lineCount: invoiceLines.length,
              });
            } else {
              console.error('[stripe-webhook-queue] Skipping invoice: no valid user for created_by');
            }
          }
        }
      } else if (itemId) {
        // ── Legacy single-item checkout ──
        const purchaseQty = parseInt(session.metadata?.purchase_quantity ?? '1', 10) || 1;

        // Single query for all needed fields (replaces two sequential fetches)
        const { data: currentItem } = await supabaseAdmin
          .from('inventory_items')
          .select('quantity, status, project_id, price, name, category, description')
          .eq('id', itemId)
          .single();

        if (currentItem) {
          // Mark as sold only when last unit (reserved state), otherwise keep available
          const updatePayload = currentItem.status === 'reserved' && currentItem.quantity === 0
            ? {
                status: 'sold' as const,
                stripe_payment_id: session.payment_intent as string,
                sold_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              }
            : {
                stripe_payment_id: session.payment_intent as string,
                updated_at: new Date().toISOString(),
              };

          // Parallel: update inventory + fetch project (independent operations)
          const [, { data: project }] = await Promise.all([
            supabaseAdmin
              .from('inventory_items')
              .update(updatePayload)
              .eq('id', itemId),
            supabaseAdmin
              .from('projects')
              .select('org_id')
              .eq('id', currentItem.project_id)
              .single(),
          ]);

          // Insert sale record
          const { data: sale } = await supabaseAdmin.from('sales').insert({
            inventory_item_id: itemId,
            seller_org_id: project?.org_id ?? null,
            buyer_email: session.customer_details?.email ?? null,
            amount: (session.amount_total ?? 0) / 100,
            quantity: purchaseQty,
            unit_price: Number(currentItem.price),
            currency: session.currency ?? 'usd',
            payment_provider: 'stripe',
            provider_session_id: session.id,
            provider_payment_id: session.payment_intent as string,
            provider_account_id: connectedAccountId ?? null,
            status: 'completed',
          }).select('id').single();

          // Notify all org members about the sale
          if (sale && project?.org_id) {
            const itemLabel = purchaseQty > 1
              ? `${currentItem.name ?? 'Unknown item'} (x${purchaseQty})`
              : (currentItem.name ?? 'Unknown item');
            await createSaleNotifications({
              orgId: project.org_id,
              saleId: sale.id,
              itemName: itemLabel,
              amount: (session.amount_total ?? 0) / 100,
              currency: session.currency ?? 'usd',
              buyerEmail: session.customer_details?.email ?? null,
            });
          }

          // Enqueue invoice generation for single-item checkout
          if (project?.org_id) {
            const { data: orgRow } = await supabaseAdmin
              .from('organizations')
              .select('created_by')
              .eq('id', project.org_id)
              .single();

            if (orgRow?.created_by) {
              await enqueueInvoiceGeneration({
                orgId: project.org_id,
                projectId: currentItem.project_id,
                stripeCheckoutSessionId: session.id,
                buyerEmail: session.customer_details?.email ?? null,
                currency: session.currency ?? 'usd',
                createdBy: orgRow.created_by,
                lines: [{
                  inventory_item_id: itemId,
                  item_name: currentItem.name ?? 'Unknown item',
                  item_category: (currentItem as Record<string, unknown>).category as string ?? 'Uncategorized',
                  item_description: (currentItem as Record<string, unknown>).description as string ?? '',
                  quantity: purchaseQty,
                  unit_price: Number(currentItem.price),
                }],
              });
              console.log('[stripe-webhook-queue] Single-item invoice enqueued', {
                sessionId: session.id,
                itemId,
                orgId: project.org_id,
              });
            } else {
              console.error('[stripe-webhook-queue] Skipping single-item invoice: no valid user for created_by');
            }
          }
        }
      }
      break;
    }

    case 'checkout.session.expired': {
      const session = data as unknown as Stripe.Checkout.Session;
      const expiredCheckoutSessionId = session.metadata?.checkout_session_id;
      const expiredItemId = session.metadata?.inventory_item_id;

      console.log('[stripe-webhook-queue] checkout.session.expired', {
        sessionId: session.id,
        checkoutSessionId: expiredCheckoutSessionId,
        itemId: expiredItemId,
      });

      if (expiredCheckoutSessionId) {
        // Multi-item expiry: use shared idempotent restore
        await restoreCheckoutSession(expiredCheckoutSessionId, 'expired');
        console.log('[stripe-webhook-queue] Multi-item checkout session expired, inventory restored');
      } else if (expiredItemId) {
        // Legacy single-item expiry
        const purchaseQty = parseInt(session.metadata?.purchase_quantity ?? '1', 10) || 1;
        await restoreSingleItem(expiredItemId, purchaseQty);
      }
      break;
    }

    // ── Subscription lifecycle ────────────────────────────────

    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const sub = data as unknown as Stripe.Subscription;
      await syncSubscriptionToOrg(sub);
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = data as unknown as Stripe.Subscription;
      await syncSubscriptionToOrg(sub, { clear: true });
      break;
    }

    case 'invoice.paid': {
      // Successful renewal — ensure the org stays in the correct state
      const invoice = data as unknown as Stripe.Invoice;
      const subRef = invoice.parent?.subscription_details?.subscription;
      const subId = typeof subRef === 'string' ? subRef : subRef?.id;
      if (subId) {
        // Direct UPDATE by stripe_subscription_id (saves a SELECT round trip)
        const { error } = await supabaseAdmin
          .from('subscriptions')
          .update({ status: 'active', updated_at: new Date().toISOString() })
          .eq('stripe_subscription_id', subId);
        if (error) console.error('update_subscription_status (active) failed:', error);
      }
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = data as unknown as Stripe.Invoice;
      const subRef2 = invoice.parent?.subscription_details?.subscription;
      const subId2 = typeof subRef2 === 'string' ? subRef2 : subRef2?.id;
      if (subId2) {
        // Direct UPDATE by stripe_subscription_id (saves a SELECT round trip)
        const { error } = await supabaseAdmin
          .from('subscriptions')
          .update({ status: 'past_due', updated_at: new Date().toISOString() })
          .eq('stripe_subscription_id', subId2);
        if (error) console.error('update_subscription_status (past_due) failed:', error);
      }
      break;
    }

    // ── Stripe Connect ───────────────────────────────────────

    case 'account.updated': {
      const account = data as unknown as Stripe.Account;
      if (account.id) {
        const chargesEnabled = account.charges_enabled ?? false;
        await supabaseAdmin
          .from('payment_provider_connections')
          .update({
            onboarding_complete: chargesEnabled,
            status: chargesEnabled ? 'connected' : 'incomplete',
            updated_at: new Date().toISOString(),
          })
          .eq('provider', 'stripe')
          .eq('external_account_id', account.id);
      }
      break;
    }

    // ── v2 Stripe Connect (thin payload) ─────────────────────

    case 'v2.core.account.created':
    case 'v2.core.account.updated': {
      const accountId = payload.relatedObject?.id;
      if (!accountId) {
        console.warn(`[stripe-webhook-queue] ${eventType}: no relatedObject.id, skipping`);
        break;
      }

      // Fetch full account from Stripe since thin events don't include it
      const { stripe: stripeClient } = await import('@/lib/stripe');
      const fullAccount = await stripeClient.accounts.retrieve(accountId);
      const chargesEnabled = fullAccount.charges_enabled ?? false;

      await supabaseAdmin
        .from('payment_provider_connections')
        .update({
          onboarding_complete: chargesEnabled,
          status: chargesEnabled ? 'connected' : 'pending',
          updated_at: new Date().toISOString(),
        })
        .eq('provider', 'stripe')
        .eq('external_account_id', accountId);

      console.log(`[stripe-webhook-queue] ${eventType}: account ${accountId} charges_enabled=${chargesEnabled}`);
      break;
    }

    case 'v2.core.account.closed': {
      const accountId = payload.relatedObject?.id;
      if (!accountId) {
        console.warn('[stripe-webhook-queue] v2.core.account.closed: no relatedObject.id, skipping');
        break;
      }

      await supabaseAdmin
        .from('payment_provider_connections')
        .update({
          status: 'disconnected',
          onboarding_complete: false,
          updated_at: new Date().toISOString(),
        })
        .eq('provider', 'stripe')
        .eq('external_account_id', accountId);

      console.log(`[stripe-webhook-queue] v2.core.account.closed: account ${accountId} disconnected`);
      break;
    }
  }

  console.log('[stripe-webhook-queue] Event processing complete', {
    eventType,
    eventId: payload.eventId,
    durationMs: Date.now() - startedAt,
  });
}

export const POST = handleCallback(async (payload: WebhookPayload) => {
  await processWebhookEvent(payload);
});
