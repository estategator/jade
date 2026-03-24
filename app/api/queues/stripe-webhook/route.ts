import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import Stripe from 'stripe';
import { tierFromStripePriceId } from '@/lib/tiers';
import { handleCallback } from '@vercel/queue';
import { createSaleNotifications } from '@/app/notifications/actions';

export type WebhookPayload = {
  eventType: string;
  eventId: string;
  data: Record<string, unknown>;
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

// ── Event processing ────────────────────────────────────────

export async function processWebhookEvent(payload: WebhookPayload): Promise<void> {
  const { eventType, data } = payload;

  console.log('[stripe-webhook-queue] Processing event:', eventType);

  switch (eventType) {
    case 'checkout.session.completed': {
      const session = data as unknown as Stripe.Checkout.Session;

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
      const connectedAccountId = session.metadata?.connected_account_id;
      const purchaseQty = parseInt(session.metadata?.purchase_quantity ?? '1', 10) || 1;

      if (itemId) {
        // Fetch current item state
        const { data: currentItem } = await supabaseAdmin
          .from('inventory_items')
          .select('quantity, status')
          .eq('id', itemId)
          .single();

        // Mark as sold only when last unit (reserved state), otherwise keep available
        if (currentItem?.status === 'reserved' && currentItem.quantity === 0) {
          await supabaseAdmin
            .from('inventory_items')
            .update({
              status: 'sold',
              stripe_payment_id: session.payment_intent as string,
              sold_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', itemId);
        } else {
          // Multi-quantity item: unit was already decremented at checkout time,
          // just record the payment reference on the item
          await supabaseAdmin
            .from('inventory_items')
            .update({
              stripe_payment_id: session.payment_intent as string,
              updated_at: new Date().toISOString(),
            })
            .eq('id', itemId);
        }

        // Look up the item to get the org
        const { data: item } = await supabaseAdmin
          .from('inventory_items')
          .select('project_id, price, name')
          .eq('id', itemId)
          .single();

        if (item) {
          const { data: project } = await supabaseAdmin
            .from('projects')
            .select('org_id')
            .eq('id', item.project_id)
            .single();

          // Insert sale record
          const { data: sale } = await supabaseAdmin.from('sales').insert({
            inventory_item_id: itemId,
            seller_org_id: project?.org_id ?? null,
            buyer_email: session.customer_details?.email ?? null,
            amount: (session.amount_total ?? 0) / 100,
            currency: session.currency ?? 'usd',
            stripe_checkout_session_id: session.id,
            stripe_payment_intent_id: session.payment_intent as string,
            stripe_connected_account_id: connectedAccountId ?? null,
            status: 'completed',
          }).select('id').single();

          // Notify all org members about the sale
          if (sale && project?.org_id) {
            const itemLabel = purchaseQty > 1
              ? `${item.name ?? 'Unknown item'} (x${purchaseQty})`
              : (item.name ?? 'Unknown item');
            await createSaleNotifications({
              orgId: project.org_id,
              saleId: sale.id,
              itemName: itemLabel,
              amount: (session.amount_total ?? 0) / 100,
              currency: session.currency ?? 'usd',
              buyerEmail: session.customer_details?.email ?? null,
            });
          }
        }
      }
      break;
    }

    case 'checkout.session.expired': {
      const session = data as unknown as Stripe.Checkout.Session;
      const itemId = session.metadata?.inventory_item_id;

      if (itemId) {
        const purchaseQty = parseInt(session.metadata?.purchase_quantity ?? '1', 10) || 1;
        const { data: expiredItem } = await supabaseAdmin
          .from('inventory_items')
          .select('status, quantity')
          .eq('id', itemId)
          .single();

        if (expiredItem?.status === 'reserved') {
          // All units were taken in this checkout: restore to available
          await supabaseAdmin
            .from('inventory_items')
            .update({
              status: 'available',
              quantity: purchaseQty,
              updated_at: new Date().toISOString(),
            })
            .eq('id', itemId)
            .eq('status', 'reserved');
        } else if (expiredItem) {
          // Multi-quantity: restore the decremented units
          await supabaseAdmin
            .from('inventory_items')
            .update({
              quantity: (expiredItem.quantity ?? 0) + purchaseQty,
              updated_at: new Date().toISOString(),
            })
            .eq('id', itemId);
        }
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
        const { data: subRow } = await supabaseAdmin
          .from('subscriptions')
          .select('org_id')
          .eq('stripe_subscription_id', subId)
          .single();
        if (subRow) {
          const { error } = await supabaseAdmin
            .from('subscriptions')
            .update({ status: 'active', updated_at: new Date().toISOString() })
            .eq('org_id', subRow.org_id);
          if (error) console.error('update_subscription_status (active) failed:', error);
        }
      }
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = data as unknown as Stripe.Invoice;
      const subRef2 = invoice.parent?.subscription_details?.subscription;
      const subId2 = typeof subRef2 === 'string' ? subRef2 : subRef2?.id;
      if (subId2) {
        const { data: subRow2 } = await supabaseAdmin
          .from('subscriptions')
          .select('org_id')
          .eq('stripe_subscription_id', subId2)
          .single();
        if (subRow2) {
          const { error } = await supabaseAdmin
            .from('subscriptions')
            .update({ status: 'past_due', updated_at: new Date().toISOString() })
            .eq('org_id', subRow2.org_id);
          if (error) console.error('update_subscription_status (past_due) failed:', error);
        }
      }
      break;
    }

    // ── Stripe Connect ───────────────────────────────────────

    case 'account.updated': {
      const account = data as unknown as Stripe.Account;
      if (account.id) {
        const chargesEnabled = account.charges_enabled ?? false;
        await supabaseAdmin
          .from('organizations')
          .update({
            stripe_onboarding_complete: chargesEnabled,
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_account_id', account.id);
      }
      break;
    }
  }
}

export const POST = handleCallback(async (payload: WebhookPayload) => {
  await processWebhookEvent(payload);
});
