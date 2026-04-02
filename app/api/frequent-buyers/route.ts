import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

const FREQUENT_BUYER_THRESHOLD = parseInt(process.env.FREQUENT_BUYER_THRESHOLD ?? '2', 10);
const FREQUENT_BUYER_WINDOW_DAYS = parseInt(process.env.FREQUENT_BUYER_WINDOW_DAYS ?? '90', 10);

/**
 * GET  /api/frequent-buyers — Vercel Cron trigger (daily at 6 AM UTC)
 * POST /api/frequent-buyers — Manual invocation with Bearer auth
 *
 * Scans completed sales in the last N days, identifies buyers with ≥ threshold
 * purchases, and upserts suggestions into `frequent_buyer_suggestions`.
 * Notifies org admins via `user_notifications`.
 */

function authorize(req: NextRequest): NextResponse | null {
  if (req.method === 'GET') {
    const ua = req.headers.get('user-agent') ?? '';
    if (ua.startsWith('vercel-cron')) return null;
  }

  const secret = process.env.FREQUENT_BUYERS_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'Not configured.' }, { status: 503 });
  }
  const authHeader = req.headers.get('Authorization');
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  return null;
}

async function detectFrequentBuyers() {
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - FREQUENT_BUYER_WINDOW_DAYS);

  // Aggregate completed sales per (org, buyer_email) in the window
  const { data: aggregates, error: aggError } = await supabaseAdmin
    .rpc('aggregate_frequent_buyers', {
      window_start: windowStart.toISOString(),
      min_count: FREQUENT_BUYER_THRESHOLD,
    })
    .select('*');

  // Fallback: use raw query if the RPC doesn't exist yet
  if (aggError) {
    console.warn('[frequent-buyers] RPC not available, using manual query:', aggError.message);
    return detectFrequentBuyersFallback(windowStart);
  }

  return processAggregates(aggregates ?? []);
}

async function detectFrequentBuyersFallback(windowStart: Date) {
  // Get all completed sales in window
  const { data: sales, error: salesError } = await supabaseAdmin
    .from('sales')
    .select('seller_org_id, buyer_email, amount, created_at')
    .eq('status', 'completed')
    .not('buyer_email', 'is', null)
    .gte('created_at', windowStart.toISOString());

  if (salesError) {
    console.error('[frequent-buyers] sales query error:', salesError);
    return { error: salesError.message, created: 0, notified: 0 };
  }

  // Aggregate in-memory
  const map = new Map<string, { org_id: string; buyer_email: string; count: number; total: number; last_at: string }>();
  for (const sale of sales ?? []) {
    const key = `${sale.seller_org_id}::${sale.buyer_email}`;
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
      existing.total += Number(sale.amount);
      if (sale.created_at > existing.last_at) existing.last_at = sale.created_at;
    } else {
      map.set(key, {
        org_id: sale.seller_org_id as string,
        buyer_email: sale.buyer_email as string,
        count: 1,
        total: Number(sale.amount),
        last_at: sale.created_at as string,
      });
    }
  }

  const aggregates = [...map.values()]
    .filter((a) => a.count >= FREQUENT_BUYER_THRESHOLD)
    .map((a) => ({
      seller_org_id: a.org_id,
      buyer_email: a.buyer_email,
      sale_count: a.count,
      total_spent: a.total,
      last_purchase_at: a.last_at,
    }));

  return processAggregates(aggregates);
}

type BuyerAggregate = {
  seller_org_id: string;
  buyer_email: string;
  sale_count: number;
  total_spent: number;
  last_purchase_at: string;
};

async function processAggregates(aggregates: BuyerAggregate[]) {
  if (aggregates.length === 0) {
    return { created: 0, notified: 0 };
  }

  let created = 0;
  let notified = 0;
  const orgsWithNewSuggestions = new Set<string>();

  for (const agg of aggregates) {
    // Skip if already accepted or dismissed
    const { data: existing } = await supabaseAdmin
      .from('frequent_buyer_suggestions')
      .select('id, status')
      .eq('org_id', agg.seller_org_id)
      .eq('buyer_email', agg.buyer_email)
      .single();

    if (existing && existing.status !== 'pending') {
      continue;
    }

    // Upsert suggestion
    const { error: upsertError } = await supabaseAdmin
      .from('frequent_buyer_suggestions')
      .upsert(
        {
          org_id: agg.seller_org_id,
          buyer_email: agg.buyer_email,
          sale_count: agg.sale_count,
          total_spent: agg.total_spent,
          last_purchase_at: agg.last_purchase_at,
          status: 'pending',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'org_id,buyer_email' },
      );

    if (upsertError) {
      console.error('[frequent-buyers] upsert error:', upsertError);
      continue;
    }

    if (!existing) {
      created += 1;
      orgsWithNewSuggestions.add(agg.seller_org_id);
    }
  }

  // Notify org admins for each org with new suggestions
  for (const orgId of orgsWithNewSuggestions) {
    const { data: admins } = await supabaseAdmin
      .from('org_members')
      .select('user_id')
      .eq('org_id', orgId)
      .in('role', ['admin', 'superadmin']);

    for (const admin of admins ?? []) {
      const { error: notifError } = await supabaseAdmin
        .from('user_notifications')
        .upsert(
          {
            recipient_user_id: admin.user_id,
            org_id: orgId,
            kind: 'frequent_buyer_suggestion',
            source_table: 'frequent_buyer_suggestions',
            source_id: orgId, // org-level notification
            title: 'New frequent buyer suggestions',
            body: 'We found buyers who frequently shop at your sales. Review and add them to your frequents list.',
            payload: { org_id: orgId },
          },
          { onConflict: 'recipient_user_id,source_table,source_id' },
        );

      if (!notifError) notified += 1;
    }
  }

  return { created, notified };
}

export async function GET(req: NextRequest) {
  const authErr = authorize(req);
  if (authErr) return authErr;

  try {
    const result = await detectFrequentBuyers();
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
    return NextResponse.json({
      ok: true,
      created: result.created,
      notified: result.notified,
    });
  } catch (err) {
    console.error('[frequent-buyers] unexpected error:', err);
    return NextResponse.json({ error: 'Internal error.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const authErr = authorize(req);
  if (authErr) return authErr;

  try {
    const result = await detectFrequentBuyers();
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
    return NextResponse.json({
      ok: true,
      created: result.created,
      notified: result.notified,
    });
  } catch (err) {
    console.error('[frequent-buyers] unexpected error:', err);
    return NextResponse.json({ error: 'Internal error.' }, { status: 500 });
  }
}
