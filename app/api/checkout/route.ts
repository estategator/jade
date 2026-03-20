import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: NextRequest) {
  try {
    const { itemId } = await req.json();

    if (!itemId || typeof itemId !== 'string') {
      return NextResponse.json({ error: 'Missing item ID.' }, { status: 400 });
    }

    // Fetch the item with its project and organization
    const { data: item, error: dbError } = await supabaseAdmin
      .from('inventory_items')
      .select('id, name, description, price, status, project_id')
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

        if (org?.stripe_onboarding_complete && org.stripe_account_id) {
          connectedAccountId = org.stripe_account_id;
        }
      }
    }

    if (!connectedAccountId) {
      return NextResponse.json(
        { error: 'This seller has not set up payments yet.' },
        { status: 400 },
      );
    }

    // Mark item as reserved while checkout is in progress
    await supabaseAdmin
      .from('inventory_items')
      .update({ status: 'reserved', updated_at: new Date().toISOString() })
      .eq('id', itemId)
      .eq('status', 'available'); // optimistic lock

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
              },
              unit_amount: Math.round(item.price * 100),
            },
            quantity: 1,
          },
        ],
        metadata: {
          inventory_item_id: item.id,
          connected_account_id: connectedAccountId,
        },
        success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/checkout/cancel?item_id=${item.id}`,
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
