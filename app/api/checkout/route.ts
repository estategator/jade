import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: NextRequest) {
  try {
    const { itemId, quantity: requestedQty } = await req.json();

    if (!itemId || typeof itemId !== 'string') {
      return NextResponse.json({ error: 'Missing item ID.' }, { status: 400 });
    }

    const purchaseQty = Math.max(1, Math.floor(Number(requestedQty) || 1));

    // Fetch the item with its project and organization
    const { data: item, error: dbError } = await supabaseAdmin
      .from('inventory_items')
      .select('id, name, description, price, status, quantity, project_id, medium_image_url')
      .eq('id', itemId)
      .single();

    if (dbError || !item) {
      return NextResponse.json({ error: 'Item not found.' }, { status: 404 });
    }

    if (item.status !== 'available') {
      return NextResponse.json(
        { error: 'This item is no longer available for purchase.' },
        { status: 409 },
      );
    }

    if (item.quantity < 1) {
      return NextResponse.json(
        { error: 'This item is out of stock.' },
        { status: 409 },
      );
    }

    if (purchaseQty > item.quantity) {
      return NextResponse.json(
        { error: `Only ${item.quantity} available.` },
        { status: 409 },
      );
    }

    // Resolve the connected Stripe account via project → organization
    let connectedAccountId: string | null = null;

    if (item.project_id) {
      const { data: project } = await supabaseAdmin
        .from('projects')
        .select('org_id')
        .eq('id', item.project_id)
        .single();

      if (project?.org_id) {
        const { data: org } = await supabaseAdmin
          .from('organizations')
          .select('stripe_account_id, stripe_onboarding_complete')
          .eq('id', project.org_id)
          .single();

        if (org?.stripe_account_id) {
          if (org.stripe_onboarding_complete) {
            connectedAccountId = org.stripe_account_id;
          } else {
            // DB may be stale — live-check with Stripe
            const account = await stripe.accounts.retrieve(org.stripe_account_id);
            if (account.charges_enabled) {
              connectedAccountId = org.stripe_account_id;
              // Sync DB for future requests
              await supabaseAdmin
                .from('organizations')
                .update({
                  stripe_onboarding_complete: true,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', project.org_id);
            }
          }
        }
      }
    }

    if (!connectedAccountId) {
      return NextResponse.json(
        { error: 'This seller has not set up payments yet.' },
        { status: 400 },
      );
    }

    // Reserve units: decrement quantity, mark reserved only when all units are taken
    const newQuantity = item.quantity - purchaseQty;
    await supabaseAdmin
      .from('inventory_items')
      .update({
        quantity: newQuantity,
        status: newQuantity === 0 ? 'reserved' : 'available',
        updated_at: new Date().toISOString(),
      })
      .eq('id', itemId)
      .eq('status', 'available');

    const origin = req.headers.get('origin') ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

    const session = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: item.name,
                description: item.description || undefined,
                ...(item.medium_image_url ? { images: [item.medium_image_url] } : {}),
              },
              unit_amount: Math.round(item.price * 100),
            },
            quantity: purchaseQty,
          },
        ],
        metadata: {
          inventory_item_id: item.id,
          connected_account_id: connectedAccountId,
          purchase_quantity: String(purchaseQty),
        },
        success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/checkout/cancel?item_id=${item.id}&qty=${purchaseQty}`,
        expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
      },
      {
        stripeAccount: connectedAccountId,
      },
    );

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('Checkout error:', err);
    return NextResponse.json(
      { error: 'Failed to create checkout session.' },
      { status: 500 },
    );
  }
}
