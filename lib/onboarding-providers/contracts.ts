import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';

import {
  CONTRACT_SIGN_DATE_ANCHOR,
  CONTRACT_SIGN_HERE_ANCHOR,
  type ContractSendDocument,
} from './contract-document';

/**
 * Contract provider abstraction.
 *
 * Each supported e-sign provider (DocuSign, Dropbox Sign, manual)
 * implements a common interface so onboarding orchestration code
 * stays provider-agnostic.
 */

// ── Types ────────────────────────────────────────────────────

export type ContractProvider = 'docusign' | 'dropbox_sign' | 'manual';

export type ContractSendRequest = {
  /** Organization-scoped contract ID (used for metadata/callbacks). */
  contractId: string;
  /** Template identifier on the provider side, if applicable. */
  templateId?: string;
  /** Generated document content for providers that accept direct file uploads. */
  document?: ContractSendDocument;
  /** Signer details. */
  signerName: string;
  signerEmail: string;
  /** Document title / email subject for the envelope. */
  documentTitle: string;
  /** Arbitrary key-value metadata forwarded to the provider. */
  metadata?: Record<string, string>;
};

export type ContractSendResult = {
  /** Provider-assigned envelope or signature-request ID. */
  externalContractId: string;
  /** Current status as returned by the provider after sending. */
  status: 'sent' | 'draft';
  /** Provider-specific raw response data for traceability. */
  rawResponse?: Record<string, unknown>;
};

export type ContractStatusResult = {
  /** Normalized internal status. */
  status: 'draft' | 'sent' | 'viewed' | 'signed' | 'declined' | 'voided' | 'expired';
  /** ISO-8601 timestamp of the latest status change, if available. */
  updatedAt?: string;
  /** Provider-specific raw response data. */
  rawResponse?: Record<string, unknown>;
};

/** Normalized webhook event coming from any provider. */
export type NormalizedContractEvent = {
  externalContractId: string;
  eventType: string;
  normalizedStatus: ContractStatusResult['status'];
  timestamp: string;
  rawPayload: Record<string, unknown>;
};

// ── Adapter interface ────────────────────────────────────────

export interface ContractProviderAdapter {
  /** Send or create an envelope/signature request. */
  send(request: ContractSendRequest): Promise<ContractSendResult>;

  /** Fetch current status of an existing contract envelope. */
  getStatus(externalContractId: string): Promise<ContractStatusResult>;

  /** Normalize a raw webhook payload into a standard event shape. */
  normalizeWebhookEvent(payload: Record<string, unknown>): NormalizedContractEvent | null;

  /** Verify the webhook signature/HMAC. Returns true if valid. */
  verifyWebhookSignature(body: string, headers: Record<string, string>): boolean;
}

// ── DocuSign adapter ─────────────────────────────────────────

function docuSignStatusMap(dsStatus: string): ContractStatusResult['status'] {
  switch (dsStatus.toLowerCase()) {
    case 'sent':
    case 'delivered':
      return 'sent';
    case 'completed':
    case 'signed':
      return 'signed';
    case 'declined':
      return 'declined';
    case 'voided':
      return 'voided';
    case 'expired':
    case 'timedout':
      return 'expired';
    default:
      return 'draft';
  }
}

export function createDocuSignAdapter(): ContractProviderAdapter {
  const accountId = process.env.DOCUSIGN_ACCOUNT_ID ?? '';
  const baseUrl = process.env.DOCUSIGN_BASE_URL ?? 'https://demo.docusign.net/restapi';
  const integrationKey = process.env.DOCUSIGN_INTEGRATION_KEY ?? '';
  const hmacKey = process.env.DOCUSIGN_HMAC_KEY ?? '';

  async function getAccessToken(): Promise<string> {
    // In production, implement JWT grant flow with cached token refresh.
    // For now, fall back to a static access token for development.
    const token = process.env.DOCUSIGN_ACCESS_TOKEN;
    if (!token) {
      throw new Error('DocuSign access token not configured. Set DOCUSIGN_ACCESS_TOKEN or implement JWT grant.');
    }
    return token;
  }

  return {
    async send(request) {
      const token = await getAccessToken();

      const hasTemplate = Boolean(request.templateId);
      const hasDocument = Boolean(request.document);
      if (hasTemplate === hasDocument) {
        throw new Error('DocuSign send requires either a provider template or a generated document.');
      }

      const signer: Record<string, unknown> = {
        email: request.signerEmail,
        name: request.signerName,
        recipientId: '1',
        routingOrder: '1',
      };

      if (request.document) {
        signer.tabs = {
          signHereTabs: [
            {
              anchorString: CONTRACT_SIGN_HERE_ANCHOR,
              anchorUnits: 'pixels',
              anchorXOffset: '0',
              anchorYOffset: '0',
            },
          ],
          dateSignedTabs: [
            {
              anchorString: CONTRACT_SIGN_DATE_ANCHOR,
              anchorUnits: 'pixels',
              anchorXOffset: '0',
              anchorYOffset: '0',
            },
          ],
        };
      }

      const envelopeBody: Record<string, unknown> = {
        emailSubject: request.documentTitle,
        status: 'sent',
        recipients: {
          signers: [signer],
        },
        customFields: {
          textCustomFields: [
            { name: 'contractId', value: request.contractId, show: 'false' },
          ],
        },
      };

      if (request.document) {
        envelopeBody.documents = [
          {
            documentBase64: request.document.contentBase64,
            name: request.document.name,
            fileExtension: request.document.fileExtension,
            documentId: '1',
          },
        ];
      }

      if (request.templateId) {
        (envelopeBody as Record<string, unknown>).templateId = request.templateId;
      }

      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      if (integrationKey) {
        headers['X-DocuSign-Authentication'] = JSON.stringify({
          IntegratorKey: integrationKey,
        });
      }

      const res = await fetch(`${baseUrl}/v2.1/accounts/${accountId}/envelopes`, {
        method: 'POST',
        headers,
        body: JSON.stringify(envelopeBody),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`DocuSign send failed (${res.status}): ${text}`);
      }

      const data = (await res.json()) as { envelopeId: string; status: string };

      return {
        externalContractId: data.envelopeId,
        status: data.status === 'sent' ? 'sent' : 'draft',
        rawResponse: data as unknown as Record<string, unknown>,
      };
    },

    async getStatus(externalContractId) {
      const token = await getAccessToken();

      const res = await fetch(
        `${baseUrl}/v2.1/accounts/${accountId}/envelopes/${encodeURIComponent(externalContractId)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (!res.ok) {
        throw new Error(`DocuSign getStatus failed (${res.status})`);
      }

      const data = (await res.json()) as { status: string; statusChangedDateTime: string };

      return {
        status: docuSignStatusMap(data.status),
        updatedAt: data.statusChangedDateTime,
        rawResponse: data as unknown as Record<string, unknown>,
      };
    },

    normalizeWebhookEvent(payload) {
      const envelope = (payload as Record<string, unknown>).data as
        | { envelopeId?: string; envelopeSummary?: { status?: string; statusChangedDateTime?: string } }
        | undefined;

      const envelopeId = envelope?.envelopeId;
      const status = envelope?.envelopeSummary?.status;
      const timestamp = envelope?.envelopeSummary?.statusChangedDateTime;

      if (!envelopeId || !status) return null;

      return {
        externalContractId: envelopeId,
        eventType: (payload as Record<string, unknown>).event as string ?? 'unknown',
        normalizedStatus: docuSignStatusMap(status),
        timestamp: timestamp ?? new Date().toISOString(),
        rawPayload: payload,
      };
    },

    verifyWebhookSignature(body, headers) {
      if (!hmacKey) return false;
      try {
        const signature = headers['x-docusign-signature-1'] ?? '';
        const expected = createHmac('sha256', hmacKey).update(body).digest('base64');
        return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
      } catch {
        return false;
      }
    },
  };
}

// ── Dropbox Sign adapter ─────────────────────────────────────

function dropboxSignStatusMap(dsStatus: string): ContractStatusResult['status'] {
  switch (dsStatus.toLowerCase()) {
    case 'awaiting_signature':
    case 'out_for_signature':
      return 'sent';
    case 'signed':
      return 'signed';
    case 'declined':
      return 'declined';
    case 'expired':
      return 'expired';
    case 'canceled':
    case 'cancelled':
      return 'voided';
    default:
      return 'draft';
  }
}

export function createDropboxSignAdapter(): ContractProviderAdapter {
  const apiKey = process.env.DROPBOX_SIGN_API_KEY ?? '';
  const baseUrl = 'https://api.hellosign.com/v3';
  const webhookKey = process.env.DROPBOX_SIGN_WEBHOOK_KEY ?? '';

  return {
    async send(request) {
      const body: Record<string, unknown> = {
        title: request.documentTitle,
        subject: request.documentTitle,
        signers: [{ email_address: request.signerEmail, name: request.signerName }],
        metadata: { contract_id: request.contractId, ...request.metadata },
        test_mode: process.env.NODE_ENV !== 'production' ? 1 : 0,
      };

      if (request.templateId) {
        body.template_ids = [request.templateId];
      }

      const endpoint = request.templateId
        ? `${baseUrl}/signature_request/send_with_template`
        : `${baseUrl}/signature_request/send`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Dropbox Sign send failed (${res.status}): ${text}`);
      }

      const data = (await res.json()) as {
        signature_request: { signature_request_id: string; status_code: string };
      };

      return {
        externalContractId: data.signature_request.signature_request_id,
        status: 'sent',
        rawResponse: data as unknown as Record<string, unknown>,
      };
    },

    async getStatus(externalContractId) {
      const res = await fetch(
        `${baseUrl}/signature_request/${encodeURIComponent(externalContractId)}`,
        {
          headers: {
            Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`,
          },
        },
      );

      if (!res.ok) {
        throw new Error(`Dropbox Sign getStatus failed (${res.status})`);
      }

      const data = (await res.json()) as {
        signature_request: {
          signature_request_id: string;
          status_code: string;
          updated_at: number;
        };
      };

      return {
        status: dropboxSignStatusMap(data.signature_request.status_code),
        updatedAt: new Date(data.signature_request.updated_at * 1000).toISOString(),
        rawResponse: data as unknown as Record<string, unknown>,
      };
    },

    normalizeWebhookEvent(payload) {
      const event = payload as {
        event?: { event_type?: string; event_time?: string };
        signature_request?: { signature_request_id?: string; status_code?: string };
      };

      const signatureRequestId = event.signature_request?.signature_request_id;
      const eventType = event.event?.event_type;
      const statusCode = event.signature_request?.status_code;

      if (!signatureRequestId || !eventType) return null;

      return {
        externalContractId: signatureRequestId,
        eventType,
        normalizedStatus: dropboxSignStatusMap(statusCode ?? ''),
        timestamp: event.event?.event_time ?? new Date().toISOString(),
        rawPayload: payload,
      };
    },

    verifyWebhookSignature(body, headers) {
      if (!webhookKey) return false;
      try {
        const signature = headers['x-hellosign-signature'] ?? '';
        const expected = createHmac('sha256', webhookKey).update(body).digest('hex');
        return timingSafeEqual(
          Buffer.from(signature, 'hex'),
          Buffer.from(expected, 'hex'),
        );
      } catch {
        return false;
      }
    },
  };
}

// ── Manual/no-op adapter ─────────────────────────────────────

export function createManualContractAdapter(): ContractProviderAdapter {
  return {
    async send(request) {
      return {
        externalContractId: `manual_${request.contractId}`,
        status: 'sent',
      };
    },
    async getStatus() {
      return { status: 'sent' };
    },
    normalizeWebhookEvent() {
      return null;
    },
    verifyWebhookSignature() {
      return true;
    },
  };
}

// ── Factory ──────────────────────────────────────────────────

export function getContractAdapter(provider: ContractProvider): ContractProviderAdapter {
  switch (provider) {
    case 'docusign':
      return createDocuSignAdapter();
    case 'dropbox_sign':
      return createDropboxSignAdapter();
    case 'manual':
      return createManualContractAdapter();
    default:
      throw new Error(`Unsupported contract provider: ${provider as string}`);
  }
}
