import { handleCallback } from '@vercel/queue';
import { analyzeItemImage } from '@/lib/image-processing';
import { supabaseAdmin } from '@/lib/supabase-admin';

type AnalyzeImagePayload = {
  itemId: string;
};

async function handleAnalyzeImage(
  payload: AnalyzeImagePayload,
  _metadata: { messageId: string },
): Promise<void> {
  const { itemId } = payload;

  if (!itemId) {
    console.error('[analyze-image] Missing itemId in payload');
    return;
  }

  // Guard against re-processing an already-complete item (idempotency)
  const { data: item } = await supabaseAdmin
    .from('inventory_items')
    .select('processing_status')
    .eq('id', itemId)
    .single();

  if (item?.processing_status === 'complete') {
    console.log(`[analyze-image] Item ${itemId} already complete, skipping`);
    return;
  }

  await analyzeItemImage(itemId);
}

export const POST = handleCallback(handleAnalyzeImage, {
  visibilityTimeoutSeconds: 55,
});
