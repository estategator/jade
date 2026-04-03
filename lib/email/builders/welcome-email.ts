import { escapeHtml } from '../shared/escape-html';
import {
  divider,
  emailFooter,
  emailShell,
  heading,
  nextStepCard,
  paragraph,
} from '../shared/layout';
import { ONBOARDING_STEP_BLUEPRINTS } from '@/lib/onboarding';
import type { EmailContent, WelcomeEmailBuilderInput } from '../types';

// ── Step icon SVGs (inline, 20×20, indigo-600 fill) ─────────

const STEP_ICONS: Record<string, string> = {
  walkthrough_scheduled:
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
  contract_sent:
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
  contract_signed:
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
  project_shared:
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>',
  inventory_in_progress:
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>',
  pricing_in_progress:
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
  sale_ready:
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
};

const DEFAULT_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';

// ── Builder ──────────────────────────────────────────────────

/**
 * Compose the welcome email for a newly onboarded client.
 *
 * Returns a polished HTML body showing a greeting, custom message,
 * and the client's immediate next step in the onboarding journey
 * (with icon and description). Also includes a plain-text fallback.
 */
export function buildWelcomeEmailContent(request: WelcomeEmailBuilderInput): EmailContent {
  // Resolve the next step after welcome_sent from the blueprints
  const welcomeIndex = ONBOARDING_STEP_BLUEPRINTS.findIndex((s) => s.key === 'welcome_sent');
  const nextStep = ONBOARDING_STEP_BLUEPRINTS[welcomeIndex + 1];

  // ── Plain text ─────────────────────────────────────────────
  const lines: string[] = [];
  lines.push(`Hi ${request.recipientName},`);
  lines.push('');
  lines.push(`Welcome to your project "${request.projectName}" with ${request.orgName}.`);
  lines.push('');

  if (request.textBody) {
    lines.push(request.textBody);
    lines.push('');
  }

  if (nextStep) {
    lines.push('Here\'s what comes next:');
    lines.push(`  → ${nextStep.title}: ${nextStep.description}`);
    lines.push('');
  }

  lines.push('Thank you,');
  lines.push(`The ${request.orgName} team`);

  // ── HTML ───────────────────────────────────────────────────
  const htmlParts: string[] = [];

  // Greeting + heading
  htmlParts.push(heading(`Welcome, ${escapeHtml(request.recipientName)}`));
  htmlParts.push(
    paragraph(
      `You&#39;re all set for <strong style="color:#1c1917;">${escapeHtml(request.projectName)}</strong> with <strong style="color:#1c1917;">${escapeHtml(request.orgName)}</strong>.`,
    ),
  );

  // User-supplied body
  if (request.textBody) {
    htmlParts.push(paragraph(escapeHtml(request.textBody).replace(/\n/g, '<br>')));
  }

  // Next step card
  if (nextStep) {
    htmlParts.push(divider());
    htmlParts.push(paragraph('<strong style="color:#1c1917;">Here&#39;s what comes next</strong>'));
    htmlParts.push(
      nextStepCard({
        iconSvg: STEP_ICONS[nextStep.key] ?? DEFAULT_ICON,
        title: nextStep.title,
        description: nextStep.description,
      }),
    );
  }

  // Sign-off
  htmlParts.push(
    paragraph(
      `Thank you,<br><strong style="color:#1c1917;">The ${escapeHtml(request.orgName)} team</strong>`,
    ),
  );

  return {
    textBody: lines.join('\n'),
    htmlBody: emailShell(htmlParts.join('\n'), emailFooter(request.orgName)),
  };
}
