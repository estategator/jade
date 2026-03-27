import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { exchangeCloverCode, getCloverMerchant } from '@/lib/clover';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const merchantId = url.searchParams.get('merchant_id');
  const stateParam = url.searchParams.get('state');

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  if (!code || !stateParam) {
    console.error('[clover-callback] Missing code or state');
    return NextResponse.redirect(`${origin}/dashboard?providerError=clover`);
  }

  let orgId: string;
  try {
    const parsed = JSON.parse(Buffer.from(stateParam, 'base64url').toString());
    orgId = parsed.orgId;
    if (!orgId) throw new Error('Missing orgId in state');
  } catch {
    console.error('[clover-callback] Invalid state parameter');
    return NextResponse.redirect(`${origin}/dashboard?providerError=clover`);
  }

  try {
    const accessToken = await exchangeCloverCode(code);

    // Verify merchant connection via Clover API
    const mId = merchantId ?? '';
    let verifiedMerchantId = mId;

    if (mId) {
      const merchant = await getCloverMerchant(mId, accessToken);
      verifiedMerchantId = merchant.id;
    }

    if (!verifiedMerchantId) {
      console.error('[clover-callback] Could not determine merchant ID');
      return NextResponse.redirect(
        `${origin}/organizations/${orgId}/settings/connections/financials?providerError=clover`,
      );
    }

    // Check if first provider
    const { count } = await supabase
      .from('payment_provider_connections')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .neq('status', 'disconnected');

    const isFirst = (count ?? 0) === 0;

    // Clover tokens don't expire (unless revoked)
    await supabase
      .from('payment_provider_connections')
      .upsert(
        {
          org_id: orgId,
          provider: 'clover',
          external_account_id: verifiedMerchantId,
          status: 'connected',
          onboarding_complete: true,
          is_default: isFirst,
          access_token_enc: accessToken,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'org_id,provider' },
      );

    return NextResponse.redirect(
      `${origin}/organizations/${orgId}/settings/connections/financials?providerConnected=clover`,
    );
  } catch (err) {
    console.error('[clover-callback] Unexpected error:', err);
    return NextResponse.redirect(
      `${origin}/organizations/${orgId}/settings/connections/financials?providerError=clover`,
    );
  }
}
