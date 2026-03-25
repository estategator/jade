import { handleCallback } from '@vercel/queue';
import { processItemImage } from '@/lib/image-processing';
import { supabaseAdmin } from '@/lib/supabase-admin';

type ProcessImagePayload = {
  itemId: string;
  storagePath: string;
};

async function handleProcessImage(
  payload: ProcessImagePayload,
  _metadata: { messageId: string },
): Promise<void> {
  const { itemId, storagePath } = payload;

  if (!itemId || !storagePath) {
    console.error('[process-image] Missing itemId or storagePath in payload');
    return;
  }

  // Guard against re-processing an already-complete item (idempotency)
  const { data: item } = await supabaseAdmin
    .from('inventory_items')
    .select('processing_status')
    .eq('id', itemId)
    .single();

  if (item?.processing_status === 'complete') {
    console.log(`[process-image] Item ${itemId} already complete, skipping`);
    return;
  }

  await processItemImage(itemId, storagePath);
}

export const POST = handleCallback(handleProcessImage, {
  visibilityTimeoutSeconds: 55,
});
