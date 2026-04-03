import 'server-only';
import { supabaseAdmin } from '@/lib/supabase-admin';

const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Check if a Square OAuth token needs refreshing and refresh it if so.
 * Returns the current (or newly refreshed) access token.
 */
export async function ensureFreshSquareToken(connectionId: string): Promise<string> {
  const { data: conn } = await supabaseAdmin
    .from('payment_provider_connections')
    .select('access_token_enc, refresh_token_enc, token_expires_at')
    .eq('id', connectionId)
    .single();

  if (!conn?.access_token_enc) {
    throw new Error('No Square access token found for this connection.');
  }

  // If no expiry tracked or not near expiry, return current token
  if (!conn.token_expires_at) {
    return conn.access_token_enc;
  }

  const expiresAt = new Date(conn.token_expires_at).getTime();
  if (Date.now() + TOKEN_REFRESH_BUFFER_MS < expiresAt) {
    return conn.access_token_enc;
  }

  // Token is near expiry — refresh it
  if (!conn.refresh_token_enc) {
    throw new Error('Square refresh token not available. Merchant must re-authorize.');
  }

  return refreshSquareToken(connectionId, conn.refresh_token_enc);
}

async function refreshSquareToken(connectionId: string, refreshToken: string): Promise<string> {
  const baseUrl = process.env.NODE_ENV === 'production'
    ? 'https://connect.squareup.com'
    : 'https://connect.squareupsandbox.com';

  const res = await fetch(`${baseUrl}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.SQUARE_APP_ID!,
      client_secret: process.env.SQUARE_APP_SECRET!,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    console.error('[square-token-refresh] Failed:', errorBody);
    throw new Error('Failed to refresh Square token. Merchant may need to re-authorize.');
  }

  const data = await res.json();

  await supabaseAdmin
    .from('payment_provider_connections')
    .update({
      access_token_enc: data.access_token,
      refresh_token_enc: data.refresh_token ?? refreshToken,
      token_expires_at: data.expires_at ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', connectionId);

  return data.access_token;
}
