import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const stateParam = url.searchParams.get('state');
  const errorParam = url.searchParams.get('error');

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  if (errorParam || !code || !stateParam) {
    console.error('[square-callback] OAuth error or missing params:', errorParam);
    return NextResponse.redirect(`${origin}/dashboard?providerError=square`);
  }

  let orgId: string;
  try {
    const parsed = JSON.parse(Buffer.from(stateParam, 'base64url').toString());
    orgId = parsed.orgId;
    if (!orgId) throw new Error('Missing orgId in state');
  } catch {
    console.error('[square-callback] Invalid state parameter');
    return NextResponse.redirect(`${origin}/dashboard?providerError=square`);
  }

  try {
    const baseUrl = process.env.NODE_ENV === 'production'
      ? 'https://connect.squareup.com'
      : 'https://connect.squareupsandbox.com';

    const tokenRes = await fetch(`${baseUrl}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.SQUARE_APP_ID!,
        client_secret: process.env.SQUARE_APP_SECRET!,
        code,
        grant_type: 'authorization_code',
        redirect_uri: `${origin}/api/providers/square/callback`,
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.json().catch(() => ({}));
      console.error('[square-callback] Token exchange failed:', err);
      return NextResponse.redirect(
        `${origin}/organizations/${orgId}/settings/connections/financials?providerError=square`,
      );
    }

    const tokenData = await tokenRes.json();
    const { access_token, refresh_token, merchant_id, expires_at } = tokenData;

    if (!merchant_id || !access_token) {
      console.error('[square-callback] Missing merchant_id or access_token');
      return NextResponse.redirect(
        `${origin}/organizations/${orgId}/settings/connections/financials?providerError=square`,
      );
    }

    // Check if first provider
    const { count } = await supabase
      .from('payment_provider_connections')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .neq('status', 'disconnected');

    const isFirst = (count ?? 0) === 0;

    await supabase
      .from('payment_provider_connections')
      .upsert(
        {
          org_id: orgId,
          provider: 'square',
          external_account_id: merchant_id,
          status: 'connected',
          onboarding_complete: true,
          is_default: isFirst,
          access_token_enc: access_token,
          refresh_token_enc: refresh_token ?? null,
          token_expires_at: expires_at ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'org_id,provider' },
      );

    return NextResponse.redirect(
      `${origin}/organizations/${orgId}/settings/connections/financials?providerConnected=square`,
    );
  } catch (err) {
    console.error('[square-callback] Unexpected error:', err);
    return NextResponse.redirect(
      `${origin}/organizations/${orgId}/settings/connections/financials?providerError=square`,
    );
  }
}
