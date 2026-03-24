import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: NextRequest) {
  try {
    const { itemId, quantity: cancelQtyRaw } = await req.json();

    if (!itemId || typeof itemId !== 'string') {
      return NextResponse.json({ error: 'Missing item ID.' }, { status: 400 });
    }

    const cancelQty = Math.max(1, Math.floor(Number(cancelQtyRaw) || 1));

    // Fetch current item to check state
    const { data: item } = await supabaseAdmin
      .from('inventory_items')
      .select('status, quantity')
      .eq('id', itemId)
      .single();

    if (!item || item.status === 'sold') {
      // Already sold or missing — nothing to restore
      return NextResponse.json({ released: false });
    }

    if (item.status === 'reserved') {
      // All units were taken: restore to available with the cancelled quantity
      await supabaseAdmin
        .from('inventory_items')
        .update({ status: 'available', quantity: cancelQty, updated_at: new Date().toISOString() })
        .eq('id', itemId)
        .eq('status', 'reserved');
    } else {
      // Item is still available (partial purchase): restore the decremented units
      await supabaseAdmin
        .from('inventory_items')
        .update({
          quantity: (item.quantity ?? 0) + cancelQty,
          updated_at: new Date().toISOString(),
        })
        .eq('id', itemId)
        .eq('status', 'available');
    }

    return NextResponse.json({ released: true });
  } catch {
    return NextResponse.json({ error: 'Failed to release reservation.' }, { status: 500 });
  }
}
