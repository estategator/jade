import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: NextRequest) {
  try {
    const { itemId } = await req.json();

    if (!itemId || typeof itemId !== 'string') {
      return NextResponse.json({ error: 'Missing item ID.' }, { status: 400 });
    }

    // Release reservation — only if still reserved
    await supabaseAdmin
      .from('inventory_items')
      .update({ status: 'available', updated_at: new Date().toISOString() })
      .eq('id', itemId)
      .eq('status', 'reserved');

    return NextResponse.json({ released: true });
  } catch {
    return NextResponse.json({ error: 'Failed to release reservation.' }, { status: 500 });
  }
}
