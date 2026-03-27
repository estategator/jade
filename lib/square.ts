import 'server-only';
import { SquareClient, SquareEnvironment } from 'square';

const squareEnvironment = process.env.NODE_ENV === 'production'
  ? SquareEnvironment.Production
  : SquareEnvironment.Sandbox;

/** Platform-level client (uses app credentials for OAuth flows). */
export const squareClient = new SquareClient({
  token: process.env.SQUARE_ACCESS_TOKEN!,
  environment: squareEnvironment,
});

export const { oAuth: oAuthApi, merchants: merchantsApi } = squareClient;

/**
 * Create a merchant-scoped Square client using their OAuth access token.
 * Use this for all operations on behalf of a connected merchant.
 */
export function createMerchantSquareClient(accessToken: string) {
  const client = new SquareClient({
    token: accessToken,
    environment: squareEnvironment,
  });
  return { client };
}
