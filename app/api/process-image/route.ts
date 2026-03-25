import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { processItemImage } from '@/lib/image-processing';

export async function POST(req: Request) {
  const authHeader = req.headers.get('authorization');
  const secret = process.env.QUEUE_SECRET;
  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { itemId } = (await req.json()) as { itemId?: string };
  if (!itemId) {
    return NextResponse.json({ error: 'itemId is required' }, { status: 400 });
  }

  const { data: item, error } = await supabaseAdmin
    .from('inventory_items')
    .select('original_image_url, ai_insights')
    .eq('id', itemId)
    .single();

  if (error || !item?.original_image_url) {
    return NextResponse.json({ error: 'Item not found or has no image' }, { status: 404 });
  }

  const url = new URL(item.original_image_url);
  const pathMatch = url.pathname.match(/\/inventory-images\/(.+)$/);
  if (!pathMatch) {
    return NextResponse.json({ error: 'Could not resolve storage path' }, { status: 400 });
  }

  const storagePath = decodeURIComponent(pathMatch[1]);
  await processItemImage(itemId, storagePath, { skipAnalysis: !!item.ai_insights });

  return NextResponse.json({ success: true });
}
