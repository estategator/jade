import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

async function restoreSingleItem(itemId: string, cancelQty: number) {
  const { data: item } = await supabaseAdmin
    .from('inventory_items')
    .select('status, quantity')
    .eq('id', itemId)
    .single();

  if (!item || item.status === 'sold') {
    return false;
  }

  // Always add the reserved quantity back to whatever the current quantity is,
  // and ensure the item is marked available.
  await supabaseAdmin
    .from('inventory_items')
    .update({
      status: 'available',
      quantity: (item.quantity ?? 0) + cancelQty,
      updated_at: new Date().toISOString(),
    })
    .eq('id', itemId);

  return true;
}

async function restoreCheckoutSession(checkoutSessionId: string, targetStatus: 'cancelled' | 'expired' = 'cancelled') {
  // Atomically flip status from 'pending' — if another caller already flipped it,
  // the update matches zero rows and we skip restoration (idempotent).
  const { data: updated } = await supabaseAdmin
    .from('checkout_sessions')
    .update({ status: targetStatus, updated_at: new Date().toISOString() })
    .eq('id', checkoutSessionId)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle();

  if (!updated) {
    // Already processed by webhook or another cancel call
    return false;
  }

  // Load session items and restore each
  const { data: sessionItems } = await supabaseAdmin
    .from('checkout_session_items')
    .select('inventory_item_id, reserved_quantity')
    .eq('checkout_session_id', checkoutSessionId);

  if (!sessionItems?.length) return false;

  const reservedByItemId = new Map<string, number>();
  for (const sessionItem of sessionItems) {
    reservedByItemId.set(
      sessionItem.inventory_item_id,
      (reservedByItemId.get(sessionItem.inventory_item_id) ?? 0) + sessionItem.reserved_quantity,
    );
  }

  const itemIds = [...reservedByItemId.keys()];
  const { data: inventoryItems } = await supabaseAdmin
    .from('inventory_items')
    .select('id, status, quantity')
    .in('id', itemIds);

  if (!inventoryItems?.length) return true;

  const updatedAt = new Date().toISOString();

  await Promise.all(
    inventoryItems
      .filter((item) => item.status !== 'sold')
      .map(async (item) => {
        const { error } = await supabaseAdmin
          .from('inventory_items')
          .update({
            status: 'available',
            quantity: (item.quantity ?? 0) + (reservedByItemId.get(item.id) ?? 0),
            updated_at: updatedAt,
          })
          .eq('id', item.id);

        if (error) {
          console.error('restoreCheckoutSession update error:', error);
        }
      }),
  );

  return true;
}

// Re-export for use in webhook handler
export { restoreCheckoutSession, restoreSingleItem };

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Multi-item: checkout session ID
    if (body.checkoutSessionId && typeof body.checkoutSessionId === 'string') {
      const released = await restoreCheckoutSession(body.checkoutSessionId);
      return NextResponse.json({ released });
    }

    // Legacy single-item
    const { itemId, quantity: cancelQtyRaw } = body;

    if (!itemId || typeof itemId !== 'string') {
      return NextResponse.json({ error: 'Missing item ID.' }, { status: 400 });
    }

    const cancelQty = Math.max(1, Math.floor(Number(cancelQtyRaw) || 1));
    const released = await restoreSingleItem(itemId, cancelQty);
    return NextResponse.json({ released });
  } catch {
    return NextResponse.json({ error: 'Failed to release reservation.' }, { status: 500 });
  }
}
