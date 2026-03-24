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

  if (item.status === 'reserved') {
    await supabaseAdmin
      .from('inventory_items')
      .update({ status: 'available', quantity: cancelQty, updated_at: new Date().toISOString() })
      .eq('id', itemId)
      .eq('status', 'reserved');
  } else {
    await supabaseAdmin
      .from('inventory_items')
      .update({
        quantity: (item.quantity ?? 0) + cancelQty,
        updated_at: new Date().toISOString(),
      })
      .eq('id', itemId)
      .eq('status', 'available');
  }

  return true;
}

async function restoreCheckoutSession(checkoutSessionId: string) {
  // Load session items
  const { data: sessionItems } = await supabaseAdmin
    .from('checkout_session_items')
    .select('inventory_item_id, reserved_quantity')
    .eq('checkout_session_id', checkoutSessionId);

  if (!sessionItems?.length) return false;

  // Restore each reserved item
  for (const si of sessionItems) {
    await restoreSingleItem(si.inventory_item_id, si.reserved_quantity);
  }

  // Mark checkout session as cancelled
  await supabaseAdmin
    .from('checkout_sessions')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', checkoutSessionId)
    .eq('status', 'pending');

  return true;
}

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
