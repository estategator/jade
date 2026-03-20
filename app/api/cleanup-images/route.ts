import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

const RETENTION_DAYS = Number(process.env.IMAGE_RETENTION_DAYS ?? '30');

/**
 * POST /api/cleanup-images
 *
 * Deletes retained source images for fully-processed items whose retention
 * window has expired. Thumbnail and medium variants are preserved.
 *
 * Secured with `Authorization: Bearer <CLEANUP_SECRET>` header.
 * Intended to be called by a cron job (e.g. Vercel Cron or an external scheduler).
 */
export async function POST(req: NextRequest) {
  const cleanupSecret = process.env.CLEANUP_SECRET;
  if (!cleanupSecret) {
    return NextResponse.json({ error: 'Cleanup not configured.' }, { status: 503 });
  }

  const authHeader = req.headers.get('Authorization');
  if (authHeader !== `Bearer ${cleanupSecret}`) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() - RETENTION_DAYS);

  const { data: items, error } = await supabaseAdmin
    .from('inventory_items')
    .select('id, original_image_url')
    .not('original_image_url', 'is', null)
    .eq('processing_status', 'complete')
    .lt('created_at', expiresAt.toISOString());

  if (error) {
    console.error('cleanup-images query error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let deleted = 0;
  const errors: string[] = [];

  for (const item of items ?? []) {
    const sourceUrl = item.original_image_url as string;
    let sourcePath: string;
    try {
      const url = new URL(sourceUrl);
      const match = url.pathname.match(/\/inventory-images\/(.+)$/);
      if (!match) throw new Error('unrecognised URL shape');
      sourcePath = decodeURIComponent(match[1]);
    } catch {
      errors.push(`${item.id}: could not parse source URL`);
      continue;
    }

    const { error: storageError } = await supabaseAdmin.storage
      .from('inventory-images')
      .remove([sourcePath]);

    if (storageError) {
      errors.push(`${item.id}: ${storageError.message}`);
      continue;
    }

    await supabaseAdmin
      .from('inventory_items')
      .update({ original_image_url: null })
      .eq('id', item.id);

    deleted++;
  }

  return NextResponse.json({ deleted, errors, retentionDays: RETENTION_DAYS });
}
