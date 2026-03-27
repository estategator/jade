import 'server-only';

const CLOVER_BASE_URL = process.env.NODE_ENV === 'production'
  ? 'https://api.clover.com'
  : 'https://sandbox.dev.clover.com';

const CLOVER_AUTH_BASE = process.env.NODE_ENV === 'production'
  ? 'https://www.clover.com'
  : 'https://sandbox.dev.clover.com';

interface CloverRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: Record<string, unknown>;
  token: string;
}

export class CloverApiError extends Error {
  constructor(
    public status: number,
    public body: Record<string, unknown>,
  ) {
    super(`Clover API error ${status}: ${JSON.stringify(body)}`);
    this.name = 'CloverApiError';
  }
}

export async function cloverApi<T>(
  path: string,
  { method = 'GET', body, token }: CloverRequestOptions,
): Promise<T> {
  const res = await fetch(`${CLOVER_BASE_URL}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new CloverApiError(res.status, errorBody);
  }

  return res.json() as Promise<T>;
}

/**
 * Build the Clover OAuth authorization URL for merchant onboarding.
 */
export function getCloverAuthUrl(redirectUri: string, state: string): string {
  return `${CLOVER_AUTH_BASE}/oauth/v2/authorize?client_id=${encodeURIComponent(process.env.CLOVER_APP_ID!)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`;
}

/**
 * Exchange an authorization code for a Clover access token.
 */
export async function exchangeCloverCode(code: string): Promise<string> {
  const res = await fetch(`${CLOVER_AUTH_BASE}/oauth/v2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.CLOVER_APP_ID!,
      client_secret: process.env.CLOVER_APP_SECRET!,
      code,
    }),
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new CloverApiError(res.status, errorBody);
  }

  const { access_token } = await res.json();
  return access_token;
}

/**
 * Fetch merchant details to verify the connection is healthy.
 */
export async function getCloverMerchant(merchantId: string, token: string) {
  return cloverApi<{ id: string; name: string; owner?: { id: string } }>(
    `/v3/merchants/${merchantId}`,
    { token },
  );
}
