import { describe, it, expect } from 'vitest';
import { buildWelcomeEmailContent } from '../builders/welcome-email';

describe('buildWelcomeEmailContent', () => {
  const BASE_INPUT = {
    recipientName: 'Jane Doe',
    orgName: 'Acme Estate Sales',
    projectName: 'Doe Residence',
    textBody: 'We look forward to working with you.',
  };

  it('includes greeting with recipient name', () => {
    const result = buildWelcomeEmailContent(BASE_INPUT);
    expect(result.textBody).toContain('Hi Jane Doe,');
    expect(result.htmlBody).toContain('Jane Doe');
  });

  it('includes project and org names', () => {
    const result = buildWelcomeEmailContent(BASE_INPUT);
    expect(result.textBody).toContain('Doe Residence');
    expect(result.textBody).toContain('Acme Estate Sales');
  });

  it('includes user-supplied text body', () => {
    const result = buildWelcomeEmailContent(BASE_INPUT);
    expect(result.textBody).toContain('We look forward to working with you.');
  });

  it('includes next step section from onboarding blueprints', () => {
    const result = buildWelcomeEmailContent(BASE_INPUT);
    expect(result.textBody).toContain("Here's what comes next:");
    expect(result.htmlBody).toContain('what comes next');
  });

  it('does NOT include shareUrl or portal link', () => {
    const result = buildWelcomeEmailContent(BASE_INPUT);
    expect(result.textBody).not.toContain('shareUrl');
    expect(result.textBody).not.toContain('/client/');
    expect(result.htmlBody).not.toContain('Open Client Portal');
  });

  it('does NOT include contract card or agreement info', () => {
    const result = buildWelcomeEmailContent(BASE_INPUT);
    expect(result.textBody).not.toContain('Agreement');
    expect(result.textBody).not.toContain('Contract');
    expect(result.htmlBody).not.toContain('Agreement');
  });

  it('includes sign-off', () => {
    const result = buildWelcomeEmailContent(BASE_INPUT);
    expect(result.textBody).toContain('Thank you,');
    expect(result.textBody).toContain('The Acme Estate Sales team');
  });

  it('returns both textBody and htmlBody', () => {
    const result = buildWelcomeEmailContent(BASE_INPUT);
    expect(typeof result.textBody).toBe('string');
    expect(typeof result.htmlBody).toBe('string');
    expect(result.htmlBody).toContain('<!DOCTYPE html>');
  });
});
