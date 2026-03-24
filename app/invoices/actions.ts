'use server';

import { revalidatePath } from 'next/cache';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { requireOrgMembership, requirePermission, auditLog } from '@/lib/rbac';

// ── Types ────────────────────────────────────────────────────

export type InvoiceAddress = {
  phone?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
};

export type Invoice = {
  id: string;
  org_id: string;
  project_id: string | null;
  invoice_number: string;
  status: 'draft' | 'finalized' | 'void';
  period_start: string;
  period_end: string;
  subtotal: number;
  tax_amount: number;
  total: number;
  line_count: number;
  notes: string;
  filters_used: InvoiceFilters;
  created_by: string;
  created_at: string;
  updated_at: string;
  project?: ({ id: string; name: string } & InvoiceAddress) | null;
  organization?: ({ id: string; name: string } & InvoiceAddress) | null;
};

export type InvoiceLine = {
  id: string;
  invoice_id: string;
  inventory_item_id: string | null;
  item_name: string;
  item_category: string;
  item_description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  sold_at: string | null;
  created_at: string;
};

export type InvoiceFilters = {
  org_id: string;
  project_id?: string;
  period_start: string;
  period_end: string;
  category?: string;
  status_filter?: string;
  min_price?: number;
  max_price?: number;
};

/** Lightweight invoice type for list views (excludes heavy columns). */
export type InvoiceListItem = {
  id: string;
  org_id: string;
  project_id: string | null;
  invoice_number: string;
  status: 'draft' | 'finalized' | 'void';
  period_start: string;
  period_end: string;
  total: number;
  line_count: number;
  notes: string;
  created_at: string;
  project?: { id: string; name: string } | null;
};

export type InvoiceWithLines = Invoice & {
  lines: InvoiceLine[];
};

// ── Helpers ──────────────────────────────────────────────────

/**
 * Convert a local date string (e.g. "2026-03-24") + IANA timezone
 * to an ISO-8601 UTC string representing the start or end of that local day.
 * This ensures date filtering respects the user's timezone.
 */
function localDateToUTC(
  dateStr: string,
  timezone: string,
  boundary: 'start' | 'end',
): string {
  // Build a date-time string in the target timezone
  const timePart = boundary === 'start' ? '00:00:00.000' : '23:59:59.999';
  // Use Intl to find the UTC offset for this date+time in the given timezone
  try {
    const localDt = new Date(`${dateStr}T${timePart}`);
    // Format in the target timezone to get the offset
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
      timeZoneName: 'longOffset',
    });
    const parts = formatter.formatToParts(localDt);
    const tzOffset = parts.find(p => p.type === 'timeZoneName')?.value ?? '+00:00';
    // tzOffset is like "GMT-05:00" or "GMT+05:30", extract the offset part
    const offsetMatch = tzOffset.match(/GMT([+-]\d{2}:\d{2})/);
    const offset = offsetMatch ? offsetMatch[1] : '+00:00';
    // Return ISO string with the timezone offset so Postgres can convert to UTC
    return `${dateStr}T${timePart}${offset}`;
  } catch {
    // Fallback to UTC if timezone is invalid
    return `${dateStr}T${timePart}Z`;
  }
}

function generateInvoiceNumber(): string {
  const now = new Date();
  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `INV-${datePart}-${rand}`;
}

function revalidateInvoiceRoutes() {
  revalidatePath('/invoices', 'layout');
  revalidatePath('/invoices');
}

// ── Server Actions ───────────────────────────────────────────

/** List invoices for the active org, with optional status filter and pagination. */
export async function getInvoices(
  userId: string,
  orgId: string,
  statusFilter?: string,
  page: number = 0,
  pageSize: number = 50,
): Promise<{ data?: InvoiceListItem[]; error?: string; hasMore?: boolean }> {
  try {
    if (!orgId) return { data: [] };

    const membership = await requireOrgMembership(orgId, userId);
    if ('error' in membership) return { error: membership.error };

    const from = page * pageSize;
    const to = from + pageSize;

    let query = supabase
      .from('invoices')
      .select(
        'id, org_id, project_id, invoice_number, status, period_start, period_end, total, line_count, notes, created_at, project:projects(id, name)',
      )
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (statusFilter && statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Supabase error:', error);
      return { error: 'Failed to load invoices.' };
    }

    const rows = (data ?? []) as unknown as InvoiceListItem[];
    // If we got pageSize+1 rows, there are more pages
    const hasMore = rows.length > pageSize;
    return { data: hasMore ? rows.slice(0, pageSize) : rows, hasMore };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

/** Get a single invoice with its line items. */
export async function getInvoiceDetail(
  userId: string,
  invoiceId: string,
): Promise<{ data?: InvoiceWithLines; error?: string }> {
  try {
    // Fetch the invoice with project address details
    const { data: invoice, error: invErr } = await supabase
      .from('invoices')
      .select('*, project:projects(id, name, phone, address_line1, address_line2, city, state, zip_code)')
      .eq('id', invoiceId)
      .single();

    if (invErr || !invoice) {
      return { error: 'Invoice not found.' };
    }

    // Verify org membership
    const membership = await requireOrgMembership(invoice.org_id, userId);
    if ('error' in membership) return { error: membership.error };

    // Fetch org details and lines in parallel (independent queries)
    const [orgResult, linesResult] = await Promise.all([
      supabase
        .from('organizations')
        .select('id, name, phone, address_line1, address_line2, city, state, zip_code')
        .eq('id', invoice.org_id)
        .single(),
      supabase
        .from('invoice_lines')
        .select('*')
        .eq('invoice_id', invoiceId)
        .order('created_at', { ascending: true }),
    ]);

    if (linesResult.error) {
      console.error('Supabase error:', linesResult.error);
      return { error: 'Failed to load invoice lines.' };
    }

    return {
      data: {
        ...(invoice as Invoice),
        organization: orgResult.data as Invoice['organization'] ?? null,
        lines: (linesResult.data ?? []) as InvoiceLine[],
      },
    };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

/** Get projects for the org (used by the filter form). */
export async function getOrgProjects(
  userId: string,
  orgId: string,
): Promise<{ data?: { id: string; name: string }[]; error?: string }> {
  try {
    if (!orgId) return { data: [] };

    const membership = await requireOrgMembership(orgId, userId);
    if ('error' in membership) return { error: membership.error };

    const { data, error } = await supabase
      .from('projects')
      .select('id, name')
      .eq('org_id', orgId)
      .order('name', { ascending: true });

    if (error) {
      console.error('Supabase error:', error);
      return { error: 'Failed to load projects.' };
    }

    return { data: (data ?? []) as { id: string; name: string }[] };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

/** Get distinct categories for the org's inventory (used by the filter form). */
export async function getOrgCategories(
  userId: string,
  orgId: string,
): Promise<{ data?: string[]; error?: string }> {
  try {
    if (!orgId) return { data: [] };

    const membership = await requireOrgMembership(orgId, userId);
    if ('error' in membership) return { error: membership.error };

    // Use RPC or distinct-on to avoid fetching every row
    const { data, error } = await supabase
      .from('inventory_items')
      .select('category')
      .eq('org_id', orgId)
      .order('category', { ascending: true });

    if (error) {
      console.error('Supabase error:', error);
      return { error: 'Failed to load categories.' };
    }

    // Deduplicate — still needed since Supabase JS lacks native DISTINCT,
    // but we now sort server-side and skip the client .sort().
    const unique = [...new Set((data ?? []).map((d) => d.category))];
    return { data: unique };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

/**
 * Generate an invoice from filtered sales/inventory data.
 * Snapshots sold inventory items matching the filters into invoice lines.
 */
export async function generateInvoice(
  formData: FormData,
): Promise<{ data?: Invoice; error?: string }> {
  const userId = formData.get('user_id') as string;
  const orgId = formData.get('org_id') as string;
  const projectId = (formData.get('project_id') as string) || null;
  const periodStart = formData.get('period_start') as string;
  const periodEnd = formData.get('period_end') as string;
  const timezone = (formData.get('timezone') as string) || 'America/New_York';
  const category = (formData.get('category') as string) || null;
  const statusFilter = (formData.get('status_filter') as string) || 'completed';
  const minPriceRaw = formData.get('min_price') as string;
  const maxPriceRaw = formData.get('max_price') as string;
  const notes = (formData.get('notes') as string) || '';

  // ── Validation ──
  if (!userId || !orgId) return { error: 'Organization is required.' };
  if (!periodStart || !periodEnd) return { error: 'Date range is required.' };

  const start = new Date(periodStart);
  const end = new Date(periodEnd);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return { error: 'Invalid date format.' };
  }
  if (start > end) {
    return { error: 'Start date must be before or equal to end date.' };
  }

  // Cap max range at 1 year
  const oneYear = 365 * 24 * 60 * 60 * 1000;
  if (end.getTime() - start.getTime() > oneYear) {
    return { error: 'Date range cannot exceed one year.' };
  }

  const minPrice = minPriceRaw ? parseFloat(minPriceRaw) : null;
  const maxPrice = maxPriceRaw ? parseFloat(maxPriceRaw) : null;
  if (minPrice !== null && isNaN(minPrice)) return { error: 'Invalid minimum price.' };
  if (maxPrice !== null && isNaN(maxPrice)) return { error: 'Invalid maximum price.' };
  if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
    return { error: 'Minimum price cannot exceed maximum price.' };
  }

  // ── Permission check ──
  const permCheck = await requirePermission(orgId, userId, 'invoices:create');
  if (!permCheck.granted) return { error: permCheck.error };

  try {
    // ── Query eligible sales records (joined to inventory items for details) ──
    let salesQuery = supabase
      .from('sales')
      .select('id, inventory_item_id, amount, quantity, unit_price, currency, status, created_at, inventory_items!inner(id, name, description, category, project_id)')
      .eq('seller_org_id', orgId);

    if (statusFilter) {
      salesQuery = salesQuery.eq('status', statusFilter);
    }

    // Date range filter on sales.created_at (when the sale happened).
    const rangeStart = localDateToUTC(periodStart, timezone, 'start');
    const rangeEnd = localDateToUTC(periodEnd, timezone, 'end');
    salesQuery = salesQuery
      .gte('created_at', rangeStart)
      .lte('created_at', rangeEnd);

    const { data: salesRows, error: salesErr } = await salesQuery
      .order('created_at', { ascending: true });

    if (salesErr) {
      console.error('Supabase error:', salesErr);
      return { error: 'Failed to query sales data.' };
    }

    if (!salesRows || salesRows.length === 0) {
      return { error: 'No sales match the selected filters. Adjust your filters and try again.' };
    }

    // ── Apply item-level filters (project, category, price) in app code ──
    type SaleRow = (typeof salesRows)[number];
    const filtered = salesRows.filter((sale: SaleRow) => {
      const item = sale.inventory_items as unknown as Record<string, unknown> | null;
      if (!item) return false;
      if (projectId && item.project_id !== projectId) return false;
      if (category && item.category !== category) return false;
      if (minPrice !== null && Number(sale.amount) < minPrice) return false;
      if (maxPrice !== null && Number(sale.amount) > maxPrice) return false;
      return true;
    });

    if (filtered.length === 0) {
      return { error: 'No sales match the selected filters. Adjust your filters and try again.' };
    }

    // ── Compute totals from sales data ──
    // Each sale has quantity + unit_price. line_total = unit_price * quantity.
    // sale.amount is the total paid (unit_price * qty), kept as a cross-check.
    const lines = filtered.map((sale: SaleRow) => {
      const item = sale.inventory_items as unknown as Record<string, unknown> | null;
      const qty = Number(sale.quantity) || 1;
      const unitPrice = Number(sale.unit_price) || Number(sale.amount) / qty;
      return {
        inventory_item_id: sale.inventory_item_id,
        item_name: (item?.name as string) ?? 'Unknown Item',
        item_category: (item?.category as string) ?? 'Uncategorized',
        item_description: (item?.description as string) ?? '',
        quantity: qty,
        unit_price: unitPrice,
        line_total: unitPrice * qty,
        sold_at: sale.created_at || null,
      };
    });

    const subtotal = lines.reduce((sum, l) => sum + l.line_total, 0);
    const taxAmount = 0; // Tax logic can be extended later
    const total = subtotal + taxAmount;

    const filtersUsed: InvoiceFilters = {
      org_id: orgId,
      ...(projectId && { project_id: projectId }),
      period_start: periodStart,
      period_end: periodEnd,
      ...(category && { category }),
      ...(statusFilter && { status_filter: statusFilter }),
      ...(minPrice !== null && { min_price: minPrice }),
      ...(maxPrice !== null && { max_price: maxPrice }),
    };

    const invoiceNumber = generateInvoiceNumber();

    // ── Insert invoice header ──
    const { data: invoice, error: invoiceErr } = await supabase
      .from('invoices')
      .insert({
        org_id: orgId,
        project_id: projectId,
        invoice_number: invoiceNumber,
        status: 'draft',
        period_start: periodStart,
        period_end: periodEnd,
        subtotal,
        tax_amount: taxAmount,
        total,
        line_count: lines.length,
        notes,
        filters_used: filtersUsed,
        created_by: userId,
      })
      .select('*')
      .single();

    if (invoiceErr || !invoice) {
      console.error('Supabase error:', invoiceErr);
      if (invoiceErr?.code === '23505') {
        return { error: 'An invoice with this number already exists. Please try again.' };
      }
      return { error: 'Failed to create invoice.' };
    }

    // ── Insert invoice lines ──
    const lineRows = lines.map((l) => ({
      invoice_id: invoice.id,
      ...l,
    }));

    const { error: linesErr } = await supabase
      .from('invoice_lines')
      .insert(lineRows);

    if (linesErr) {
      console.error('Supabase error inserting lines:', linesErr);
      // Clean up the header if lines fail
      await supabase.from('invoices').delete().eq('id', invoice.id);
      return { error: 'Failed to create invoice lines. Please try again.' };
    }

    await auditLog({
      orgId,
      actorId: userId,
      action: 'invoice.created',
      targetType: 'invoice',
      targetId: invoice.id,
      metadata: { invoice_number: invoiceNumber, line_count: lines.length, total },
    });

    revalidateInvoiceRoutes();

    return { data: invoice as Invoice };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

/** Finalize a draft invoice (prevents further edits). */
export async function finalizeInvoice(
  userId: string,
  invoiceId: string,
): Promise<{ success?: boolean; error?: string }> {
  try {
    const { data: invoice, error: fetchErr } = await supabase
      .from('invoices')
      .select('id, org_id, status, invoice_number')
      .eq('id', invoiceId)
      .single();

    if (fetchErr || !invoice) return { error: 'Invoice not found.' };

    const permCheck = await requirePermission(invoice.org_id, userId, 'invoices:update');
    if (!permCheck.granted) return { error: permCheck.error };

    if (invoice.status !== 'draft') {
      return { error: 'Only draft invoices can be finalized.' };
    }

    const { error: updateErr } = await supabase
      .from('invoices')
      .update({ status: 'finalized', updated_at: new Date().toISOString() })
      .eq('id', invoiceId);

    if (updateErr) {
      console.error('Supabase error:', updateErr);
      return { error: 'Failed to finalize invoice.' };
    }

    await auditLog({
      orgId: invoice.org_id,
      actorId: userId,
      action: 'invoice.updated',
      targetType: 'invoice',
      targetId: invoiceId,
      metadata: { invoice_number: invoice.invoice_number, new_status: 'finalized' },
    });

    revalidateInvoiceRoutes();
    return { success: true };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

/** Void a finalized invoice. */
export async function voidInvoice(
  userId: string,
  invoiceId: string,
): Promise<{ success?: boolean; error?: string }> {
  try {
    const { data: invoice, error: fetchErr } = await supabase
      .from('invoices')
      .select('id, org_id, status, invoice_number')
      .eq('id', invoiceId)
      .single();

    if (fetchErr || !invoice) return { error: 'Invoice not found.' };

    const permCheck = await requirePermission(invoice.org_id, userId, 'invoices:update');
    if (!permCheck.granted) return { error: permCheck.error };

    if (invoice.status === 'void') {
      return { error: 'Invoice is already void.' };
    }

    const { error: updateErr } = await supabase
      .from('invoices')
      .update({ status: 'void', updated_at: new Date().toISOString() })
      .eq('id', invoiceId);

    if (updateErr) {
      console.error('Supabase error:', updateErr);
      return { error: 'Failed to void invoice.' };
    }

    await auditLog({
      orgId: invoice.org_id,
      actorId: userId,
      action: 'invoice.updated',
      targetType: 'invoice',
      targetId: invoiceId,
      metadata: { invoice_number: invoice.invoice_number, new_status: 'void' },
    });

    revalidateInvoiceRoutes();
    return { success: true };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

/** Delete a draft invoice. Only drafts can be deleted. */
export async function deleteInvoice(
  userId: string,
  invoiceId: string,
): Promise<{ success?: boolean; error?: string }> {
  try {
    const { data: invoice, error: fetchErr } = await supabase
      .from('invoices')
      .select('id, org_id, status, invoice_number')
      .eq('id', invoiceId)
      .single();

    if (fetchErr || !invoice) return { error: 'Invoice not found.' };

    const permCheck = await requirePermission(invoice.org_id, userId, 'invoices:delete');
    if (!permCheck.granted) return { error: permCheck.error };

    if (invoice.status !== 'draft') {
      return { error: 'Only draft invoices can be deleted.' };
    }

    // Lines cascade-delete via FK
    const { error: delErr } = await supabase
      .from('invoices')
      .delete()
      .eq('id', invoiceId);

    if (delErr) {
      console.error('Supabase error:', delErr);
      return { error: 'Failed to delete invoice.' };
    }

    await auditLog({
      orgId: invoice.org_id,
      actorId: userId,
      action: 'invoice.deleted',
      targetType: 'invoice',
      targetId: invoiceId,
      metadata: { invoice_number: invoice.invoice_number },
    });

    revalidateInvoiceRoutes();
    return { success: true };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}
