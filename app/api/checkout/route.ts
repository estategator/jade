import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createClient } from '@/utils/supabase/server';
import { resolveActiveOrgId } from '@/lib/rbac';
import {
  resolveDefaultProvider,
  createProviderCheckout,
  type ProviderAccount,
  type CheckoutLineItem,
} from '@/lib/payment-providers/checkout';

// ── Helpers ─────────────────────────────────────────────────

type ResolvedItem = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  quantity: number;
  status: string;
  project_id: string;
  medium_image_url: string | null;
  purchaseQty: number;
};

async function resolveConnectedAccount(orgId: string): Promise<ProviderAccount | null> {
  return resolveDefaultProvider(orgId);
}

async function reserveItems(items: ResolvedItem[]) {
  for (const item of items) {
    const newQty = item.quantity - item.purchaseQty;
    await supabaseAdmin
      .from('inventory_items')
      .update({
        quantity: newQty,
        status: newQty === 0 ? 'reserved' : 'available',
        updated_at: new Date().toISOString(),
      })
      .eq('id', item.id)
      .eq('status', 'available');
  }
}

// ── Single-item checkout (public buy button) ────────────────

async function handleSingleItemCheckout(req: NextRequest, itemId: string, requestedQty: number) {
  const purchaseQty = Math.max(1, Math.floor(Number(requestedQty) || 1));

  const { data: item, error: dbError } = await supabaseAdmin
    .from('inventory_items')
    .select('id, name, description, price, status, quantity, project_id, medium_image_url')
    .eq('id', itemId)
    .single();

  if (dbError || !item) {
    return NextResponse.json({ error: 'Item not found.' }, { status: 404 });
  }
  if (item.status !== 'available') {
    return NextResponse.json({ error: 'This item is no longer available for purchase.' }, { status: 409 });
  }
  if (item.quantity < 1) {
    return NextResponse.json({ error: 'This item is out of stock.' }, { status: 409 });
  }
  if (purchaseQty > item.quantity) {
    return NextResponse.json({ error: `Only ${item.quantity} available.` }, { status: 409 });
  }

  // Resolve connected account
  const { data: project } = await supabaseAdmin
    .from('projects')
    .select('org_id')
    .eq('id', item.project_id)
    .single();

  if (!project?.org_id) {
    return NextResponse.json({ error: 'This seller has not set up payments yet.' }, { status: 400 });
  }

  const providerAccount = await resolveConnectedAccount(project.org_id);
  if (!providerAccount) {
    return NextResponse.json({ error: 'This seller has not set up payments yet.' }, { status: 400 });
  }

  // Reserve
  await reserveItems([{ ...item, purchaseQty }]);

  const origin = req.headers.get('origin') ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  const checkoutLineItems: CheckoutLineItem[] = [
    {
      name: item.name,
      description: item.description,
      unitAmountCents: Math.round(item.price * 100),
      quantity: purchaseQty,
      imageUrl: item.medium_image_url,
    },
  ];

  const metadata: Record<string, string> = {
    inventory_item_id: item.id,
    connected_account_id: providerAccount.externalAccountId,
    purchase_quantity: String(purchaseQty),
    cancel_url: `${origin}/checkout/cancel?item_id=${item.id}&qty=${purchaseQty}`,
  };

  try {
    const result = await createProviderCheckout(
      providerAccount,
      checkoutLineItems,
      metadata,
      origin,
    );
    return NextResponse.json({ url: result.url });
  } catch (err) {
    console.error('Provider checkout error:', err);
    return NextResponse.json({ error: 'Failed to create checkout session.' }, { status: 500 });
  }
}

// ── Cart-based multi-item checkout ──────────────────────────

async function handleCartCheckout(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const orgId = await resolveActiveOrgId(user.id);
  if (!orgId) {
    return NextResponse.json({ error: 'No active organization.' }, { status: 400 });
  }

  // Load cart items with inventory details
  const { data: cartItems, error: cartErr } = await supabaseAdmin
    .from('cart_items')
    .select(`
      id, quantity, inventory_item_id,
      inventory_item:inventory_items(
        id, name, description, price, status, quantity, project_id, medium_image_url
      )
    `)
    .eq('user_id', user.id)
    .eq('org_id', orgId);

  if (cartErr || !cartItems?.length) {
    return NextResponse.json({ error: 'Your cart is empty.' }, { status: 400 });
  }

  // Validate all items and resolve connected account (must be same org)
  let providerAccount: ProviderAccount | null = null;
  const lineItems: ResolvedItem[] = [];
  const checkoutLineItems: CheckoutLineItem[] = [];

  for (const ci of cartItems) {
    const item = ci.inventory_item as unknown as {
      id: string; name: string; description: string | null;
      price: number; status: string; quantity: number;
      project_id: string; medium_image_url: string | null;
    };

    if (!item) {
      return NextResponse.json({ error: `Cart item not found. Please refresh your cart.` }, { status: 409 });
    }
    if (item.status !== 'available') {
      return NextResponse.json({ error: `"${item.name}" is no longer available.` }, { status: 409 });
    }
    if (ci.quantity > item.quantity) {
      return NextResponse.json({ error: `Only ${item.quantity} of "${item.name}" available.` }, { status: 409 });
    }

    // Resolve project org
    const { data: project } = await supabaseAdmin
      .from('projects')
      .select('org_id')
      .eq('id', item.project_id)
      .single();

    if (!project?.org_id) {
      return NextResponse.json({ error: 'Seller has not set up payments.' }, { status: 400 });
    }

    // All items must belong to the same connected account
    if (!providerAccount) {
      providerAccount = await resolveConnectedAccount(project.org_id);
      if (!providerAccount) {
        return NextResponse.json({ error: 'This seller has not set up payments yet.' }, { status: 400 });
      }
    }

    lineItems.push({ ...item, purchaseQty: ci.quantity });
    checkoutLineItems.push({
      name: item.name,
      description: item.description,
      unitAmountCents: Math.round(item.price * 100),
      quantity: ci.quantity,
      imageUrl: item.medium_image_url,
    });
  }

  // Reserve inventory
  await reserveItems(lineItems);

  // Create internal checkout session record
  const totalAmount = lineItems.reduce((sum, li) => sum + li.price * li.purchaseQty, 0);

  const { data: checkoutSession, error: csErr } = await supabaseAdmin
    .from('checkout_sessions')
    .insert({
      user_id: user.id,
      org_id: orgId,
      stripe_connected_account_id: providerAccount!.externalAccountId,
      total_amount: totalAmount,
      status: 'pending',
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    })
    .select('id')
    .single();

  if (csErr || !checkoutSession) {
    console.error('Failed to create checkout session:', csErr);
    return NextResponse.json({ error: 'Failed to create checkout session.' }, { status: 500 });
  }

  // Insert checkout session items
  const sessionItems = lineItems.map((li) => ({
    checkout_session_id: checkoutSession.id,
    inventory_item_id: li.id,
    quantity: li.purchaseQty,
    unit_price: li.price,
    reserved_quantity: li.purchaseQty,
  }));

  await supabaseAdmin.from('checkout_session_items').insert(sessionItems);

  const origin = req.headers.get('origin') ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  const metadata: Record<string, string> = {
    checkout_session_id: checkoutSession.id,
    connected_account_id: providerAccount!.externalAccountId,
    cancel_url: `${origin}/checkout/cancel?cs_id=${checkoutSession.id}`,
  };

  try {
    const result = await createProviderCheckout(
      providerAccount!,
      checkoutLineItems,
      metadata,
      origin,
    );

    // Save provider session ID to our checkout session
    await supabaseAdmin
      .from('checkout_sessions')
      .update({
        stripe_checkout_session_id: result.providerSessionId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', checkoutSession.id);

    // Clear the cart after successful session creation
    await supabaseAdmin
      .from('cart_items')
      .delete()
      .eq('user_id', user.id)
      .eq('org_id', orgId);

    return NextResponse.json({ url: result.url });
  } catch (err) {
    console.error('Provider checkout error:', err);
    return NextResponse.json(
      { error: 'Failed to create checkout session.' },
      { status: 500 },
    );
  }
}

// ── Route handler ───────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (body.fromCart) {
      return handleCartCheckout(req);
    }

    // Legacy single-item checkout
    if (!body.itemId || typeof body.itemId !== 'string') {
      return NextResponse.json({ error: 'Missing item ID.' }, { status: 400 });
    }

    return handleSingleItemCheckout(req, body.itemId, body.quantity);
  } catch (err) {
    console.error('Checkout error:', err);
    return NextResponse.json(
      { error: 'Failed to create checkout session.' },
      { status: 500 },
    );
  }
}
