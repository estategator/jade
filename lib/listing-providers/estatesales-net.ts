/**
 * EstateSales.NET API client.
 *
 * Lightweight fetch-based client for the EstateSales.NET REST API.
 * Used for validating credentials and publishing sales.
 */

const BASE_URL = 'https://www.estatesales.net/api';

interface EstateSalesCredentials {
  username: string;
  apiKey: string;
  organizationId: string;
}

interface EstateSalesValidationResult {
  valid: boolean;
  companyName?: string;
  error?: string;
}

/**
 * Validate EstateSales.NET credentials by making a lightweight API call.
 * Returns the company name on success for display in the UI.
 */
export async function validateCredentials(
  creds: EstateSalesCredentials,
): Promise<EstateSalesValidationResult> {
  const orgIdNumeric = creds.organizationId.replace('#', '').trim();

  try {
    const response = await fetch(`${BASE_URL}/companies/${orgIdNumeric}`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${creds.username}:${creds.apiKey}`).toString('base64')}`,
        'Accept': 'application/json',
      },
    });

    if (response.status === 401 || response.status === 403) {
      return { valid: false, error: 'Invalid username or API key.' };
    }

    if (response.status === 404) {
      return { valid: false, error: 'Organization ID not found. Check your Company Settings page.' };
    }

    if (!response.ok) {
      return { valid: false, error: `EstateSales.NET returned status ${response.status}.` };
    }

    const data = await response.json() as { name?: string };
    return { valid: true, companyName: data.name ?? undefined };
  } catch {
    return { valid: false, error: 'Could not reach EstateSales.NET. Please try again later.' };
  }
}
