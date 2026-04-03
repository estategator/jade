import { describe, it, expect } from 'vitest';
import { buildContractSentEmailContent } from '../builders/contract-sent-email';

describe('buildContractSentEmailContent', () => {
  const BASE_INPUT = {
    recipientName: 'Alice Brown',
    orgName: 'Premier Estate Sales',
    projectName: 'Brown Estate',
    contractName: 'Estate Sale Agreement',
    provider: 'docusign',
  };

  it('includes greeting with recipient name', () => {
    const result = buildContractSentEmailContent(BASE_INPUT);
    expect(result.textBody).toContain('Hi Alice Brown,');
    expect(result.htmlBody).toContain('Alice Brown');
  });

  it('includes contract name and provider', () => {
    const result = buildContractSentEmailContent(BASE_INPUT);
    expect(result.textBody).toContain('Estate Sale Agreement');
    expect(result.textBody).toContain('docusign');
  });

  it('includes signing URL when provided', () => {
    const result = buildContractSentEmailContent({
      ...BASE_INPUT,
      signingUrl: 'https://docusign.example.com/sign/xyz',
    });
    expect(result.textBody).toContain('https://docusign.example.com/sign/xyz');
    expect(result.htmlBody).toContain('Review &amp; Sign');
  });

  it('shows fallback message when no signing URL', () => {
    const result = buildContractSentEmailContent(BASE_INPUT);
    expect(result.textBody).toContain('check your email for a signing link');
  });

  it('does NOT include shareUrl or portal link', () => {
    const result = buildContractSentEmailContent(BASE_INPUT);
    expect(result.textBody).not.toContain('/client/');
    expect(result.htmlBody).not.toContain('Open Client Portal');
  });

  it('does NOT include welcome-specific next steps', () => {
    const result = buildContractSentEmailContent(BASE_INPUT);
    expect(result.textBody).not.toContain("Here's what comes next:");
  });

  it('returns both textBody and htmlBody', () => {
    const result = buildContractSentEmailContent(BASE_INPUT);
    expect(typeof result.textBody).toBe('string');
    expect(typeof result.htmlBody).toBe('string');
    expect(result.htmlBody).toContain('<!DOCTYPE html>');
  });
});
