import 'server-only';

const WEBHOOK_PATH = '/api/webhooks/docuseal';
const CONSOLE_URL = 'https://console.docuseal.com/webhooks';

/**
 * Returns the full Docuseal webhook URL for the current environment.
 *
 * Uses `NEXT_PUBLIC_APP_URL` by default, or pass an explicit origin.
 *
 * Paste this URL into the Docuseal console at {@link https://console.docuseal.com/webhooks}.
 */
export function getDocusealWebhookUrl(origin?: string): string {
  const base =
    origin ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  return `${base.replace(/\/+$/, '')}${WEBHOOK_PATH}`;
}

/**
 * Returns the webhook secret or throws a helpful error.
 */
export function getDocusealWebhookSecret(): string {
  const secret = process.env.DOCUSEAL_WEBHOOK_SECRET ?? '';
  if (!secret) {
    throw new Error(
      `Missing DOCUSEAL_WEBHOOK_SECRET environment variable.\n` +
        `  1. Go to ${CONSOLE_URL}\n` +
        `  2. Set the webhook URL to: ${getDocusealWebhookUrl()}\n` +
        `  3. Copy the secret and add to .env.local:\n` +
        `     DOCUSEAL_WEBHOOK_SECRET=<secret_from_console>`,
    );
  }
  return secret;
}

/**
 * Logs the Docuseal webhook setup instructions to the console.
 * Call during server startup or from a debug endpoint.
 */
export function printDocusealWebhookSetup(): void {
  const url = getDocusealWebhookUrl();
  const hasSecret = !!process.env.DOCUSEAL_WEBHOOK_SECRET;
  const hasApiKey = !!process.env.DOCUSEAL_API_KEY;

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Docuseal Webhook Configuration
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Webhook URL :  ${url}
  API Key     :  ${hasApiKey ? '✓ configured' : '✗ MISSING — set DOCUSEAL_API_KEY'}
  Secret      :  ${hasSecret ? '✓ configured' : '✗ MISSING — set DOCUSEAL_WEBHOOK_SECRET'}

  Setup steps:
    1. Go to: ${CONSOLE_URL}
    2. Paste webhook URL: ${url}
    3. Copy the secret → add to .env.local:
       DOCUSEAL_WEBHOOK_SECRET=<secret_from_console>
    4. Restart the server
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
}
