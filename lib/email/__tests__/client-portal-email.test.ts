import { describe, it, expect } from 'vitest';
import { buildClientPortalEmailContent } from '../builders/client-portal-email';

describe('buildClientPortalEmailContent', () => {
  const BASE_INPUT = {
    recipientName: 'John Smith',
    orgName: 'Legacy Estate Sales',
    projectName: 'Smith Residence',
    shareUrl: 'https://example.com/client/abc123',
  };

  it('includes greeting with recipient name', () => {
    const result = buildClientPortalEmailContent(BASE_INPUT);
    expect(result.textBody).toContain('Hi John Smith,');
    expect(result.htmlBody).toContain('John Smith');
  });

  it('includes project and org names', () => {
    const result = buildClientPortalEmailContent(BASE_INPUT);
    expect(result.textBody).toContain('Smith Residence');
    expect(result.textBody).toContain('Legacy Estate Sales');
  });

  it('requires and includes shareUrl in both text and HTML', () => {
    const result = buildClientPortalEmailContent(BASE_INPUT);
    expect(result.textBody).toContain('https://example.com/client/abc123');
    expect(result.htmlBody).toContain('https://example.com/client/abc123');
  });

  it('includes CTA button in HTML', () => {
    const result = buildClientPortalEmailContent(BASE_INPUT);
    expect(result.htmlBody).toContain('Open Client Portal');
  });

  it('includes privacy notice', () => {
    const result = buildClientPortalEmailContent(BASE_INPUT);
    expect(result.textBody).toContain('private');
  });

  it('does NOT include welcome-specific next steps', () => {
    const result = buildClientPortalEmailContent(BASE_INPUT);
    expect(result.textBody).not.toContain("Here's what comes next:");
    expect(result.htmlBody).not.toContain('what comes next');
  });

  it('does NOT include contract info', () => {
    const result = buildClientPortalEmailContent(BASE_INPUT);
    expect(result.textBody).not.toContain('Agreement');
    expect(result.htmlBody).not.toContain('Agreement');
  });

  it('returns both textBody and htmlBody', () => {
    const result = buildClientPortalEmailContent(BASE_INPUT);
    expect(typeof result.textBody).toBe('string');
    expect(typeof result.htmlBody).toBe('string');
    expect(result.htmlBody).toContain('<!DOCTYPE html>');
  });
});
