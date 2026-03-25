import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import Stripe from 'stripe';
import { tierFromStripePriceId } from '@/lib/tiers';
import { handleCallback } from '@vercel/queue';
import { createSaleNotifications } from '@/app/notifications/actions';
import { restoreCheckoutSession, restoreSingleItem } from '@/app/api/checkout/cancel/route';

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

// ── Invoice generation helper (inline — no cross-module imports) ─

type InvoiceLineInput = {
  inventory_item_id: string;
  item_name: string;
  item_category: string;
  item_description: string;
  quantity: number;
  unit_price: number;
};

function generateInvoiceNumber(): string {
  const now = new Date();
  const d = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const r = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `INV-${d}-${r}`;
}

async function createCheckoutInvoiceInline(opts: {
  orgId: string;
  projectId: string | null;
  stripeCheckoutSessionId: string;
  buyerEmail: string | null;
  currency: string;
  createdBy: string;
  lines: InvoiceLineInput[];
}): Promise<{ invoice_number: string } | null> {
  const { orgId, projectId, stripeCheckoutSessionId, buyerEmail, currency, createdBy, lines } = opts;

  try {
    // Idempotency: check if invoice already exists
    const { data: existing } = await supabaseAdmin
      .from('invoices')
      .select('invoice_number')
      .eq('stripe_checkout_session_id', stripeCheckoutSessionId)
      .maybeSingle();

    if (existing) {
      console.log('[invoice] Already exists:', existing.invoice_number);
      return existing;
    }

    const invoiceLines = lines.map((l) => ({
      ...l,
      line_total: l.unit_price * l.quantity,
      sold_at: new Date().toISOString(),
    }));
    const subtotal = invoiceLines.reduce((sum, l) => sum + l.line_total, 0);
    const today = new Date().toISOString().slice(0, 10);
    const invoiceNumber = generateInvoiceNumber();

    console.log('[invoice] Creating:', invoiceNumber, 'session:', stripeCheckoutSessionId, 'org:', orgId, 'lines:', lines.length);

    const { data: invoice, error: invErr } = await supabaseAdmin
      .from('invoices')
      .insert({
        org_id: orgId,
        project_id: projectId,
        invoice_number: invoiceNumber,
        status: 'finalized',
        source: 'checkout',
        stripe_checkout_session_id: stripeCheckoutSessionId,
        period_start: today,
        period_end: today,
        subtotal,
        tax_amount: 0,
        total: subtotal,
        line_count: lines.length,
        notes: buyerEmail ? `Auto-generated from checkout. Buyer: ${buyerEmail}` : 'Auto-generated from checkout.',
        filters_used: { org_id: orgId, source: 'checkout', stripe_checkout_session_id: stripeCheckoutSessionId, buyer_email: buyerEmail, currency },
        created_by: createdBy,
      })
      .select('id, invoice_number')
      .single();

    if (invErr || !invoice) {
      if (invErr?.code === '23505') {
        console.log('[invoice] Duplicate caught, fetching existing');
        const { data: dup } = await supabaseAdmin.from('invoices').select('invoice_number').eq('stripe_checkout_session_id', stripeCheckoutSessionId).maybeSingle();
        return dup ?? null;
      }
      console.error('[invoice] INSERT FAILED:', invErr?.message, invErr?.code, invErr?.details, invErr?.hint);
      return null;
    }

    const lineRows = invoiceLines.map((l) => ({
      invoice_id: invoice.id,
      inventory_item_id: l.inventory_item_id,
      item_name: l.item_name,
      item_category: l.item_category,
      item_description: l.item_description,
      quantity: l.quantity,
      unit_price: l.unit_price,
      line_total: l.line_total,
      sold_at: l.sold_at,
    }));

    const { error: linesErr } = await supabaseAdmin.from('invoice_lines').insert(lineRows);
    if (linesErr) {
      console.error('[invoice] Lines INSERT FAILED:', linesErr.message, linesErr.code);
      await supabaseAdmin.from('invoices').delete().eq('id', invoice.id);
      return null;
    }

    console.log('[invoice] SUCCESS:', invoice.invoice_number);
    return { invoice_number: invoice.invoice_number };
  } catch (err) {
    console.error('[invoice] UNEXPECTED ERROR:', err);
    return null;
  }
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
      const checkoutSessionId = session.metadata?.checkout_session_id;
      const connectedAccountId = session.metadata?.connected_account_id;

      if (checkoutSessionId) {
        // ── Multi-item checkout via cart ──
        const { data: sessionItems } = await supabaseAdmin
          .from('checkout_session_items')
          .select('inventory_item_id, quantity, unit_price, reserved_quantity')
          .eq('checkout_session_id', checkoutSessionId);

        if (sessionItems?.length) {
          let totalNotified = 0;
          let firstOrgId: string | null = null;
          let firstProjectId: string | null = null;
          const invoiceLines: InvoiceLineInput[] = [];

          for (const si of sessionItems) {
            // Update inventory status
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
                  stripe_payment_id: session.payment_intent as string,
                  sold_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                })
                .eq('id', si.inventory_item_id);
            } else {
              await supabaseAdmin
                .from('inventory_items')
                .update({
                  stripe_payment_id: session.payment_intent as string,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', si.inventory_item_id);
            }

            // Look up org
            const { data: project } = await supabaseAdmin
              .from('projects')
              .select('org_id')
              .eq('id', currentItem.project_id)
              .single();

            const orgId = project?.org_id ?? null;
            if (!firstOrgId && orgId) firstOrgId = orgId;
            if (!firstProjectId && currentItem.project_id) firstProjectId = currentItem.project_id;

            // Collect line data for invoice generation
            invoiceLines.push({
              inventory_item_id: si.inventory_item_id,
              item_name: currentItem.name ?? 'Unknown item',
              item_category: (currentItem as Record<string, unknown>).category as string ?? 'Uncategorized',
              item_description: (currentItem as Record<string, unknown>).description as string ?? '',
              quantity: si.quantity,
              unit_price: si.unit_price,
            });

            // Insert sale record (one per line item)
            const { data: sale } = await supabaseAdmin.from('sales').insert({
              inventory_item_id: si.inventory_item_id,
              seller_org_id: orgId,
              buyer_email: session.customer_details?.email ?? null,
              amount: si.unit_price * si.quantity,
              quantity: si.quantity,
              unit_price: si.unit_price,
              currency: session.currency ?? 'usd',
              stripe_checkout_session_id: session.id,
              stripe_payment_intent_id: session.payment_intent as string,
              stripe_connected_account_id: connectedAccountId ?? null,
              status: 'completed',
            }).select('id').single();

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

          console.log(`[stripe-webhook-queue] Multi-item checkout completed: ${sessionItems.length} items, ${totalNotified} notifications sent`);

          // Generate invoice for the completed checkout
          if (firstOrgId && invoiceLines.length > 0) {
            // Resolve a valid user UUID for created_by
            const { data: csRow } = await supabaseAdmin
              .from('checkout_sessions')
              .select('user_id')
              .eq('id', checkoutSessionId)
              .single();

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
              const invoiceResult = await createCheckoutInvoiceInline({
                orgId: firstOrgId,
                projectId: firstProjectId,
                stripeCheckoutSessionId: session.id,
                buyerEmail: session.customer_details?.email ?? null,
                currency: session.currency ?? 'usd',
                createdBy: invoiceCreatedBy,
                lines: invoiceLines,
              });

              if (invoiceResult) {
                console.log('[stripe-webhook-queue] Invoice created:', invoiceResult.invoice_number);
              } else {
                console.error('[stripe-webhook-queue] Invoice creation failed');
              }
            } else {
              console.error('[stripe-webhook-queue] Skipping invoice: no valid user for created_by');
            }
          }
        }
      } else if (itemId) {
        // ── Legacy single-item checkout ──
        const purchaseQty = parseInt(session.metadata?.purchase_quantity ?? '1', 10) || 1;

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
          .select('project_id, price, name, category, description')
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
            quantity: purchaseQty,
            unit_price: Number(item.price),
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

          // Generate invoice for single-item checkout
          if (project?.org_id) {
            const { data: orgRow } = await supabaseAdmin
              .from('organizations')
              .select('created_by')
              .eq('id', project.org_id)
              .single();

            if (orgRow?.created_by) {
              const invoiceResult = await createCheckoutInvoiceInline({
                orgId: project.org_id,
                projectId: item.project_id,
                stripeCheckoutSessionId: session.id,
                buyerEmail: session.customer_details?.email ?? null,
                currency: session.currency ?? 'usd',
                createdBy: orgRow.created_by,
                lines: [{
                  inventory_item_id: itemId,
                  item_name: item.name ?? 'Unknown item',
                  item_category: (item as Record<string, unknown>).category as string ?? 'Uncategorized',
                  item_description: (item as Record<string, unknown>).description as string ?? '',
                  quantity: purchaseQty,
                  unit_price: Number(item.price),
                }],
              });

              if (invoiceResult) {
                console.log('[stripe-webhook-queue] Single-item invoice created:', invoiceResult.invoice_number);
              } else {
                console.error('[stripe-webhook-queue] Single-item invoice failed');
              }
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
