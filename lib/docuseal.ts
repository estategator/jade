import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';
import docuseal from '@docuseal/api';
import { SignJWT } from 'jose';

// ── Environment ──────────────────────────────────────────────

const DOCUSEAL_API_KEY = () => process.env.DOCUSEAL_API_KEY ?? '';
const DOCUSEAL_HOST = () => process.env.DOCUSEAL_HOST ?? 'docuseal.com';
const DOCUSEAL_ADMIN_EMAIL = () => process.env.DOCUSEAL_ADMIN_EMAIL ?? '';
const DOCUSEAL_WEBHOOK_SECRET = () => process.env.DOCUSEAL_WEBHOOK_SECRET ?? '';

function apiUrl(): string {
  const host = DOCUSEAL_HOST();
  return host.includes('localhost') ? `http://${host}` : `https://api.${host}`;
}

/** Ensure the SDK is configured before every call. */
function ensureConfigured() {
  const key = DOCUSEAL_API_KEY();
  if (!key) throw new Error('DOCUSEAL_API_KEY is not configured.');
  docuseal.configure({ key, url: apiUrl() });
}

// ── Types ────────────────────────────────────────────────────

export type DocusealTemplate = {
  id: number;
  slug: string;
  name: string;
  schema: { attachment_uuid: string; name: string }[];
  fields: {
    uuid: string;
    name: string;
    type: string;
    required: boolean;
    submitter_uuid: string;
  }[];
  submitters: { name: string; uuid: string }[];
  folder_name: string;
  external_id: string | null;
  created_at: string;
  updated_at: string;
  documents: {
    id: number;
    uuid: string;
    url: string;
    preview_image_url?: string;
    filename?: string;
  }[];
};

export type DocusealSubmitter = {
  id: number;
  submission_id: number;
  uuid: string;
  email: string;
  slug: string;
  sent_at: string | null;
  opened_at: string | null;
  completed_at: string | null;
  declined_at: string | null;
  name: string | null;
  status: string;
  role: string;
  embed_src: string;
};

export type DocusealSubmission = {
  id: number;
  slug: string;
  status: string;
  submitters: DocusealSubmitter[];
  template: { id: number; name: string };
  created_at: string;
  updated_at: string;
};

// ── Builder JWT ──────────────────────────────────────────────

/**
 * Generate a short-lived JWT for the embedded Docuseal builder.
 * The JWT payload is signed with the API key using HS256.
 */
export async function generateBuilderToken(opts: {
  templateId?: number;
  documentUrls?: string[];
  name?: string;
}): Promise<string> {
  const apiKey = DOCUSEAL_API_KEY();
  if (!apiKey) throw new Error('DOCUSEAL_API_KEY is not configured.');

  const adminEmail = DOCUSEAL_ADMIN_EMAIL();
  if (!adminEmail) throw new Error('DOCUSEAL_ADMIN_EMAIL is not configured.');

  const secret = new TextEncoder().encode(apiKey);

  const payload: Record<string, unknown> = {
    user_email: adminEmail,
  };

  if (opts.templateId) {
    payload.template_id = opts.templateId;
  }
  if (opts.documentUrls?.length) {
    payload.document_urls = opts.documentUrls;
  }
  if (opts.name) {
    payload.name = opts.name;
  }

  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(secret);
}

// ── Template CRUD ────────────────────────────────────────────

export async function listTemplates(opts?: {
  folder?: string;
  limit?: number;
}): Promise<DocusealTemplate[]> {
  ensureConfigured();
  const data = await docuseal.listTemplates({
    ...(opts?.folder ? { folder: opts.folder } : {}),
    ...(opts?.limit ? { limit: opts.limit } : {}),
  });
  return data as unknown as DocusealTemplate[];
}

export async function getTemplate(templateId: number): Promise<DocusealTemplate> {
  ensureConfigured();
  const data = await docuseal.getTemplate(templateId);
  return data as unknown as DocusealTemplate;
}

export async function archiveTemplate(templateId: number): Promise<void> {
  ensureConfigured();
  await docuseal.archiveTemplate(templateId);
}

// ── Submissions (contract sending) ───────────────────────────

export type CreateSubmissionParams = {
  templateId: number;
  signerEmail: string;
  signerName: string;
  sendEmail?: boolean;
  completedRedirectUrl?: string;
  metadata?: Record<string, string>;
  message?: { subject: string; body: string };
};

export type CreateSubmissionResult = {
  submissionId: number;
  submitters: DocusealSubmitter[];
};

export async function createSubmission(
  params: CreateSubmissionParams,
): Promise<CreateSubmissionResult> {
  ensureConfigured();

  const submissionData: {
    template_id: number;
    send_email: boolean;
    submitters: { role: string; email: string; name: string; metadata?: Record<string, string> }[];
    completed_redirect_url?: string;
    message?: { subject: string; body: string };
  } = {
    template_id: params.templateId,
    send_email: params.sendEmail ?? true,
    submitters: [
      {
        role: 'First Party',
        email: params.signerEmail,
        name: params.signerName,
        metadata: params.metadata ?? {},
      },
    ],
  };

  if (params.completedRedirectUrl) {
    submissionData.completed_redirect_url = params.completedRedirectUrl;
  }
  if (params.message) {
    submissionData.message = params.message;
  }

  const data = await docuseal.createSubmission(submissionData);

  // The SDK posts to /submissions/init which returns a submission object
  // with a nested submitters array: { id, submitters: [...], ... }
  // The raw API POST /submissions returns a flat submitter array.
  // Handle both shapes defensively.
  if (Array.isArray(data)) {
    // Flat array of submitters (raw API shape)
    const submitters = data as unknown as DocusealSubmitter[];
    return {
      submissionId: submitters[0]?.submission_id ?? 0,
      submitters,
    };
  }

  // Submission object with nested submitters (SDK /submissions/init shape)
  const submission = data as unknown as { id: number; submitters: DocusealSubmitter[] };
  return {
    submissionId: submission.id,
    submitters: submission.submitters ?? [],
  };
}

export async function getSubmission(submissionId: number): Promise<DocusealSubmission> {
  ensureConfigured();
  const data = await docuseal.getSubmission(submissionId);
  return data as unknown as DocusealSubmission;
}

// ── Webhook verification & normalization ─────────────────────

export function verifyWebhookSignature(body: string, signatureHeader: string): boolean {
  const secret = DOCUSEAL_WEBHOOK_SECRET();
  if (!secret) {
    console.warn(
      '[docuseal] DOCUSEAL_WEBHOOK_SECRET is not set — webhook signature verification disabled.\n' +
        '  Configure it at https://console.docuseal.com/webhooks',
    );
    return false;
  }
  try {
    const expected = createHmac('sha256', secret).update(body).digest('hex');
    return timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expected));
  } catch {
    return false;
  }
}

type DocusealWebhookPayload = {
  event_type: string;
  timestamp: string;
  data: {
    id: number;
    email: string;
    status: string;
    sent_at: string | null;
    opened_at: string | null;
    completed_at: string | null;
    declined_at: string | null;
    submission: {
      id: number;
      status: string;
    };
    template: {
      id: number;
      name: string;
      external_id: string | null;
    };
  };
};

export type NormalizedDocusealEvent = {
  /** The Docuseal submission ID — maps to contracts.external_contract_id */
  submissionId: number;
  eventType: string;
  normalizedStatus: 'sent' | 'viewed' | 'signed' | 'declined' | 'expired' | 'draft';
  timestamp: string;
  rawPayload: Record<string, unknown>;
};

export function normalizeWebhookEvent(
  payload: Record<string, unknown>,
): NormalizedDocusealEvent | null {
  const p = payload as unknown as DocusealWebhookPayload;
  if (!p.event_type || !p.data?.submission?.id) return null;

  const statusMap: Record<string, NormalizedDocusealEvent['normalizedStatus']> = {
    'form.viewed': 'viewed',
    'form.started': 'viewed',
    'form.completed': 'signed',
    'form.declined': 'declined',
  };

  const normalizedStatus = statusMap[p.event_type] ?? 'sent';

  return {
    submissionId: p.data.submission.id,
    eventType: p.event_type,
    normalizedStatus,
    timestamp: p.data.completed_at ?? p.data.opened_at ?? p.timestamp ?? new Date().toISOString(),
    rawPayload: payload,
  };
}

// ── Status mapping helper (for adapter) ──────────────────────

export function docusealStatusMap(status: string): 'draft' | 'sent' | 'viewed' | 'signed' | 'declined' | 'voided' | 'expired' {
  switch (status.toLowerCase()) {
    case 'pending':
    case 'awaiting':
      return 'sent';
    case 'opened':
      return 'viewed';
    case 'completed':
      return 'signed';
    case 'declined':
      return 'declined';
    case 'expired':
      return 'expired';
    default:
      return 'draft';
  }
}
