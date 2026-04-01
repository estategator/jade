import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

/** Items older than this without a finalized image are considered abandoned. */
const ABANDON_THRESHOLD_HOURS = 24;
/** Once soft-marked, wait this long before hard-deleting. */
const PURGE_GRACE_HOURS = 24;

/**
 * GET  /api/cleanup-abandoned — Vercel Cron trigger (daily at 2 AM UTC)
 * POST /api/cleanup-abandoned — Manual invocation with Bearer auth
 *
 * Two-phase cleanup for inventory items prepared but never finalized
 * (user closed or abandoned the tab before upload completed).
 *
 * Phase 1 (soft-mark): Sets `abandoned_at` on candidate rows.
 * Phase 2 (purge): Hard-deletes rows marked longer than the grace window.
 */

function authorize(req: NextRequest): NextResponse | null {
  // Vercel Cron sends GET with user-agent "vercel-cron/1.0"
  if (req.method === 'GET') {
    const ua = req.headers.get('user-agent') ?? '';
    if (ua.startsWith('vercel-cron')) return null; // authorized
  }

  // Manual invocation: Bearer token
  const cleanupSecret = process.env.CLEANUP_SECRET;
  if (!cleanupSecret) {
    return NextResponse.json({ error: 'Cleanup not configured.' }, { status: 503 });
  }
  const authHeader = req.headers.get('Authorization');
  if (authHeader !== `Bearer ${cleanupSecret}`) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  return null;
}

async function runCleanup() {
  const errors: string[] = [];
  let marked = 0;
  let purged = 0;
  let skipped = 0;

  try {
    // ── Phase 1: Soft-mark abandoned candidates ──────────────────────────
    const abandonCutoff = new Date();
    abandonCutoff.setHours(abandonCutoff.getHours() - ABANDON_THRESHOLD_HOURS);

    const { data: candidates, error: queryErr } = await supabaseAdmin
      .from('inventory_items')
      .select('id')
      .is('original_image_url', null)
      .is('abandoned_at', null)
      .in('processing_status', ['queued', 'processing', 'failed'])
      .lt('created_at', abandonCutoff.toISOString());

    if (queryErr) {
      console.error('[cleanup-abandoned] candidate query error:', queryErr);
      return { error: queryErr.message };
    }

    const candidateIds = (candidates ?? []).map((r) => r.id);

    if (candidateIds.length > 0) {
      // Exclude any items that somehow ended up in a sale (defensive check)
      const { data: linkedSales } = await supabaseAdmin
        .from('sales')
        .select('inventory_item_id')
        .in('inventory_item_id', candidateIds);

      const linkedIds = new Set((linkedSales ?? []).map((s) => s.inventory_item_id));
      const markIds = candidateIds.filter((id) => !linkedIds.has(id));
      skipped += candidateIds.length - markIds.length;

      if (markIds.length > 0) {
        const { error: markErr } = await supabaseAdmin
          .from('inventory_items')
          .update({ abandoned_at: new Date().toISOString() })
          .in('id', markIds);

        if (markErr) {
          errors.push(`soft-mark failed: ${markErr.message}`);
        } else {
          marked = markIds.length;
        }
      }
    }

    // ── Phase 2: Purge previously-marked rows past grace window ─────────
    const purgeCutoff = new Date();
    purgeCutoff.setHours(purgeCutoff.getHours() - PURGE_GRACE_HOURS);

    const { data: purgeRows, error: purgeQueryErr } = await supabaseAdmin
      .from('inventory_items')
      .select('id')
      .not('abandoned_at', 'is', null)
      .lt('abandoned_at', purgeCutoff.toISOString());

    if (purgeQueryErr) {
      errors.push(`purge query failed: ${purgeQueryErr.message}`);
    } else {
      const purgeIds = (purgeRows ?? []).map((r) => r.id);

      if (purgeIds.length > 0) {
        // Clean up any orphan storage objects before deleting rows
        const { data: itemsWithStorage } = await supabaseAdmin
          .from('inventory_items')
          .select('id, original_image_url, thumbnail_url, medium_image_url')
          .in('id', purgeIds);

        const storagePaths: string[] = [];
        for (const item of itemsWithStorage ?? []) {
          for (const url of [item.original_image_url, item.thumbnail_url, item.medium_image_url]) {
            if (!url) continue;
            try {
              const parsed = new URL(url as string);
              const match = parsed.pathname.match(/\/inventory-images\/(.+)$/);
              if (match) storagePaths.push(decodeURIComponent(match[1]));
            } catch { /* skip unparseable URLs */ }
          }
        }

        if (storagePaths.length > 0) {
          const { error: storageErr } = await supabaseAdmin.storage
            .from('inventory-images')
            .remove(storagePaths);

          if (storageErr) {
            errors.push(`storage cleanup: ${storageErr.message}`);
          }
        }

        const { error: deleteErr } = await supabaseAdmin
          .from('inventory_items')
          .delete()
          .in('id', purgeIds);

        if (deleteErr) {
          errors.push(`purge delete failed: ${deleteErr.message}`);
        } else {
          purged = purgeIds.length;
        }
      }
    }
  } catch (err) {
    console.error('[cleanup-abandoned] unexpected error:', err);
    return { error: 'Unexpected error during cleanup.' };
  }

  return { marked, purged, skipped, errors };
}

export async function GET(req: NextRequest) {
  const authErr = authorize(req);
  if (authErr) return authErr;

  const result = await runCleanup();
  if ('error' in result && typeof result.error === 'string' && !('marked' in result)) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const authErr = authorize(req);
  if (authErr) return authErr;

  const result = await runCleanup();
  if ('error' in result && typeof result.error === 'string' && !('marked' in result)) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json(result);
}
