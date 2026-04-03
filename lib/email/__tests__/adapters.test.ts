import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createManualEmailAdapter,
  createResendAdapter,
  createSendGridAdapter,
  type EmailSendRequest,
} from '@/lib/email';

// ── Fixtures ─────────────────────────────────────────────────

const WELCOME_REQUEST: EmailSendRequest = {
  kind: 'welcome',
  messageId: 'msg-welcome-1',
  to: 'client@example.com',
  recipientName: 'Jane Doe',
  subject: 'Welcome!',
  textBody: 'Hello',
  htmlBody: '<p>Hello</p>',
  orgName: 'Acme',
  projectName: 'Doe Residence',
};

const PORTAL_REQUEST: EmailSendRequest = {
  kind: 'client_portal',
  messageId: 'msg-portal-1',
  to: 'client@example.com',
  recipientName: 'Jane Doe',
  subject: 'Your Portal',
  textBody: 'Your portal is ready',
  htmlBody: '<p>Your portal is ready</p>',
  orgName: 'Acme',
  projectName: 'Doe Residence',
  shareUrl: 'https://app.example.com/client/abc',
};

const CONTRACT_REQUEST: EmailSendRequest = {
  kind: 'contract_sent',
  messageId: 'contract-1',
  to: 'client@example.com',
  recipientName: 'Jane Doe',
  subject: 'Agreement Sent',
  textBody: 'Please sign',
  htmlBody: '<p>Please sign</p>',
  orgName: 'Acme',
  projectName: 'Doe Residence',
  contractName: 'Estate Sale Agreement',
  contractProvider: 'docusign',
  signingUrl: 'https://docusign.example.com/sign/xyz',
};

// ── Manual adapter ───────────────────────────────────────────

describe('createManualEmailAdapter', () => {
  it('handles welcome request and returns message ID with kind prefix', async () => {
    const adapter = createManualEmailAdapter();
    const result = await adapter.send(WELCOME_REQUEST);
    expect(result.status).toBe('sent');
    expect(result.externalMessageId).toContain('manual_');
    expect(result.externalMessageId).toContain('msg-welcome-1');
  });

  it('handles client_portal request', async () => {
    const adapter = createManualEmailAdapter();
    const result = await adapter.send(PORTAL_REQUEST);
    expect(result.status).toBe('sent');
    expect(result.externalMessageId).toContain('msg-portal-1');
  });

  it('handles contract_sent request', async () => {
    const adapter = createManualEmailAdapter();
    const result = await adapter.send(CONTRACT_REQUEST);
    expect(result.status).toBe('sent');
    expect(result.externalMessageId).toContain('contract-1');
  });
});

// ── Resend adapter — verify payload shape ────────────────────

describe('createResendAdapter', () => {
  beforeEach(() => {
    vi.stubEnv('RESEND_API_KEY', 'test-key-123');
    vi.stubEnv('RESEND_FROM_ADDRESS', 'test@example.com');
  });

  it('sends correct tags with welcome kind', async () => {
    let capturedBody: string | undefined;
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
      capturedBody = init.body as string;
      return new Response(JSON.stringify({ id: 'resend-id-1' }), { status: 200 });
    }));

    const adapter = createResendAdapter();
    const result = await adapter.send(WELCOME_REQUEST);

    expect(result.status).toBe('sent');
    expect(result.externalMessageId).toBe('resend-id-1');

    const parsed = JSON.parse(capturedBody!);
    expect(parsed.tags).toEqual(
      expect.arrayContaining([
        { name: 'message_id', value: 'msg-welcome-1' },
        { name: 'type', value: 'welcome' },
      ]),
    );
  });

  it('sends correct tags with client_portal kind', async () => {
    let capturedBody: string | undefined;
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
      capturedBody = init.body as string;
      return new Response(JSON.stringify({ id: 'resend-id-2' }), { status: 200 });
    }));

    const adapter = createResendAdapter();
    await adapter.send(PORTAL_REQUEST);

    const parsed = JSON.parse(capturedBody!);
    expect(parsed.tags).toEqual(
      expect.arrayContaining([
        { name: 'type', value: 'client_portal' },
      ]),
    );
  });

  it('sends correct tags with contract_sent kind', async () => {
    let capturedBody: string | undefined;
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
      capturedBody = init.body as string;
      return new Response(JSON.stringify({ id: 'resend-id-3' }), { status: 200 });
    }));

    const adapter = createResendAdapter();
    await adapter.send(CONTRACT_REQUEST);

    const parsed = JSON.parse(capturedBody!);
    expect(parsed.tags).toEqual(
      expect.arrayContaining([
        { name: 'message_id', value: 'contract-1' },
        { name: 'type', value: 'contract_sent' },
      ]),
    );
  });

  it('returns failed on API error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response('Unauthorized', { status: 401 }),
    ));

    const adapter = createResendAdapter();
    const result = await adapter.send(WELCOME_REQUEST);
    expect(result.status).toBe('failed');
    expect(result.error).toContain('401');
  });
});

// ── SendGrid adapter — verify payload shape ──────────────────

describe('createSendGridAdapter', () => {
  beforeEach(() => {
    vi.stubEnv('SENDGRID_API_KEY', 'test-sg-key');
    vi.stubEnv('SENDGRID_FROM_ADDRESS', 'test@example.com');
  });

  it('sends correct custom_args with email kind', async () => {
    let capturedBody: string | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        capturedBody = init.body as string;
        return new Response(null, {
          status: 202,
          headers: { 'x-message-id': 'sg-id-1' },
        });
      }),
    );

    const adapter = createSendGridAdapter();
    const result = await adapter.send(PORTAL_REQUEST);

    expect(result.status).toBe('sent');
    expect(result.externalMessageId).toBe('sg-id-1');

    const parsed = JSON.parse(capturedBody!);
    const customArgs = parsed.personalizations[0].custom_args;
    expect(customArgs.message_id).toBe('msg-portal-1');
    expect(customArgs.email_type).toBe('client_portal');
  });
});
