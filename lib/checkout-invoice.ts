import 'server-only';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { auditLog } from '@/lib/rbac';

// ── Types ────────────────────────────────────────────────────

export type CheckoutInvoiceLineInput = {
  inventory_item_id: string;
  item_name: string;
  item_category: string;
  item_description: string;
  quantity: number;
  unit_price: number;
};

export type CreateCheckoutInvoiceInput = {
  orgId: string;
  projectId?: string | null;
  stripeCheckoutSessionId: string;
  buyerEmail: string | null;
  currency: string;
  createdBy: string; // must be a valid auth.users UUID
  lines: CheckoutInvoiceLineInput[];
};

// ── Helpers ──────────────────────────────────────────────────

function generateInvoiceNumber(): string {
  const now = new Date();
  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `INV-${datePart}-${rand}`;
}

// ── Core logic ───────────────────────────────────────────────

/**
 * Create a finalized invoice from a successful checkout.
 *
 * Idempotent: uses the `stripe_checkout_session_id` unique index to
 * prevent duplicates. Safe to call from webhook retries.
 *
 * This module is NOT a server action so it can be safely called
 * from route handlers and queue processors.
 */
export async function createCheckoutInvoice(
  input: CreateCheckoutInvoiceInput,
): Promise<{ data?: { id: string; invoice_number: string; total: number }; error?: string }> {
  const { orgId, projectId, stripeCheckoutSessionId, buyerEmail, currency, createdBy, lines } = input;

  if (!orgId || !stripeCheckoutSessionId || lines.length === 0) {
    console.error('[checkout-invoice] Missing required fields:', { orgId, stripeCheckoutSessionId, lineCount: lines.length });
    return { error: 'Missing required fields for checkout invoice.' };
  }

  try {
    // ── Idempotency: check existing by stripe_checkout_session_id ──
    const { data: existing, error: lookupErr } = await supabaseAdmin
      .from('invoices')
      .select('id, invoice_number, total')
      .eq('stripe_checkout_session_id', stripeCheckoutSessionId)
      .maybeSingle();

    if (lookupErr) {
      console.error('[checkout-invoice] Idempotency lookup failed:', lookupErr.message);
      // Continue — the unique index will catch true duplicates at insert time
    }

    if (existing) {
      console.log('[checkout-invoice] Already exists for session:', stripeCheckoutSessionId, existing.invoice_number);
      return { data: existing };
    }

    // ── Compute totals ──
    const invoiceLines = lines.map((l) => ({
      ...l,
      line_total: l.unit_price * l.quantity,
      sold_at: new Date().toISOString(),
    }));
    const subtotal = invoiceLines.reduce((sum, l) => sum + l.line_total, 0);
    const total = subtotal; // tax = 0 for now

    const today = new Date().toISOString().slice(0, 10);
    const invoiceNumber = generateInvoiceNumber();

    console.log('[checkout-invoice] Inserting:', { orgId, invoiceNumber, stripeCheckoutSessionId, lines: lines.length, total, createdBy });

    // ── Insert invoice header ──
    const { data: invoice, error: invoiceErr } = await supabaseAdmin
      .from('invoices')
      .insert({
        org_id: orgId,
        project_id: projectId ?? null,
        invoice_number: invoiceNumber,
        status: 'finalized',
        source: 'checkout',
        stripe_checkout_session_id: stripeCheckoutSessionId,
        period_start: today,
        period_end: today,
        subtotal,
        tax_amount: 0,
        total,
        line_count: invoiceLines.length,
        notes: buyerEmail
          ? `Auto-generated from checkout. Buyer: ${buyerEmail}`
          : 'Auto-generated from checkout.',
        filters_used: {
          org_id: orgId,
          period_start: today,
          period_end: today,
          source: 'checkout',
          stripe_checkout_session_id: stripeCheckoutSessionId,
          buyer_email: buyerEmail,
          currency,
        },
        created_by: createdBy,
      })
      .select('id, invoice_number, total')
      .single();

    if (invoiceErr || !invoice) {
      if (invoiceErr?.code === '23505') {
        // Race condition — another process inserted first
        console.log('[checkout-invoice] Duplicate insert caught, fetching existing');
        const { data: dup } = await supabaseAdmin
          .from('invoices')
          .select('id, invoice_number, total')
          .eq('stripe_checkout_session_id', stripeCheckoutSessionId)
          .maybeSingle();
        if (dup) return { data: dup };
      }
      console.error('[checkout-invoice] INSERT FAILED:', invoiceErr?.message, invoiceErr?.code, invoiceErr?.details, invoiceErr?.hint);
      return { error: `Invoice insert failed: ${invoiceErr?.message ?? 'unknown'}` };
    }

    console.log('[checkout-invoice] Header created:', invoice.id, invoice.invoice_number);

    // ── Insert invoice lines ──
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

    const { error: linesErr } = await supabaseAdmin
      .from('invoice_lines')
      .insert(lineRows);

    if (linesErr) {
      console.error('[checkout-invoice] Lines INSERT FAILED:', linesErr.message, linesErr.code);
      await supabaseAdmin.from('invoices').delete().eq('id', invoice.id);
      return { error: `Invoice lines insert failed: ${linesErr.message}` };
    }

    console.log('[checkout-invoice] Lines created:', lineRows.length);

    // ── Audit ──
    await auditLog({
      orgId,
      actorId: createdBy,
      action: 'invoice.created',
      targetType: 'invoice',
      targetId: invoice.id,
      metadata: { invoice_number: invoiceNumber, line_count: lines.length, total, source: 'checkout' },
    });

    console.log('[checkout-invoice] SUCCESS:', invoiceNumber, 'for Stripe session:', stripeCheckoutSessionId);
    return { data: invoice };
  } catch (err) {
    console.error('[checkout-invoice] UNEXPECTED ERROR:', err);
    return { error: 'Unexpected error creating checkout invoice.' };
  }
}

/**
 * Look up an invoice by Stripe checkout session ID.
 */
export async function getInvoiceByStripeSessionId(
  stripeCheckoutSessionId: string,
): Promise<{ id: string; invoice_number: string } | null> {
  if (!stripeCheckoutSessionId) return null;

  const { data } = await supabaseAdmin
    .from('invoices')
    .select('id, invoice_number')
    .eq('stripe_checkout_session_id', stripeCheckoutSessionId)
    .maybeSingle();

  return data ?? null;
}
