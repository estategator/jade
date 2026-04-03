import type { SubscriptionTier } from '@/lib/tiers';

export type FaqCategory = 'getting-started' | 'billing' | 'inventory' | 'marketing' | 'clients' | 'contracts' | 'troubleshooting';

export interface FaqItem {
  id: string;
  category: FaqCategory;
  question: string;
  answer: string;
  /** Minimum tier required to see this FAQ. 'free' means visible to all. */
  minTier: SubscriptionTier;
}

const TIER_RANK: Record<SubscriptionTier, number> = {
  free: 0,
  pro: 1,
  enterprise: 2,
};

export function isTierAtLeast(current: SubscriptionTier, required: SubscriptionTier): boolean {
  return TIER_RANK[current] >= TIER_RANK[required];
}

export const FAQ_CATEGORIES: { id: FaqCategory; label: string }[] = [
  { id: 'getting-started', label: 'Getting Started' },
  { id: 'billing', label: 'Billing & Plans' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'clients', label: 'Clients' },
  { id: 'contracts', label: 'Contracts' },
  { id: 'troubleshooting', label: 'Troubleshooting' },
];

export const FAQS: FaqItem[] = [
  // ── Getting Started ────────────────────────────────────────
  {
    id: 'gs-1',
    category: 'getting-started',
    question: 'How do I create my first estate sale?',
    answer:
      'Navigate to the Inventory page from the sidebar, then click "Add Item" to start cataloging your estate sale items. You can add photos, descriptions, and let our AI suggest pricing.',
    minTier: 'free',
  },
  {
    id: 'gs-2',
    category: 'getting-started',
    question: 'How do I invite team members?',
    answer:
      'Go to your Organization settings, then the Team tab. Click "Invite Member" and enter their email address. They\'ll receive an invitation notification. Note: Free plans are limited to 1 member.',
    minTier: 'free',
  },
  {
    id: 'gs-3',
    category: 'getting-started',
    question: 'What does the AI-powered pricing do?',
    answer:
      'Our AI analyzes item photos and descriptions to suggest competitive prices based on market data. Basic AI is available on all plans. Pro and Enterprise plans unlock advanced market analysis and trend predictions.',
    minTier: 'free',
  },

  // ── Billing ────────────────────────────────────────────────
  {
    id: 'bill-1',
    category: 'billing',
    question: 'How do I upgrade my plan?',
    answer:
      'Visit the Pricing page or go to your Organization Settings > Billing. Click "Upgrade" on the plan you want. You\'ll be redirected to our secure Stripe checkout.',
    minTier: 'free',
  },
  {
    id: 'bill-2',
    category: 'billing',
    question: 'Can I cancel my subscription?',
    answer:
      'Yes. Go to Organization Settings > Billing and click "Manage Subscription" to access the Stripe billing portal. You can cancel anytime — your plan stays active until the end of the billing period.',
    minTier: 'free',
  },
  {
    id: 'bill-3',
    category: 'billing',
    question: 'How does Stripe Connect integration work?',
    answer:
      'Pro and Enterprise plans can connect their own Stripe account to accept payments directly from buyers. Go to Organization Settings > Billing to start the Stripe Connect onboarding process.',
    minTier: 'pro',
  },

  // ── Inventory ──────────────────────────────────────────────
  {
    id: 'inv-1',
    category: 'inventory',
    question: 'How do I bulk-add items?',
    answer:
      'From the Inventory page, click "Bulk Add" to upload multiple items at once. You can add photos and descriptions for each item, and our AI will process them in the background.',
    minTier: 'free',
  },
  {
    id: 'inv-2',
    category: 'inventory',
    question: 'What image formats are supported?',
    answer:
      'We support JPEG, PNG, and WebP images up to 10MB each. For best AI analysis results, use well-lit photos with the item clearly visible.',
    minTier: 'free',
  },
  {
    id: 'inv-3',
    category: 'inventory',
    question: 'Can I generate QR codes for items?',
    answer:
      'Yes! Open any inventory item and click the QR code icon to generate a printable QR code. You can use these for item tagging during estate sales.',
    minTier: 'free',
  },

  // ── Marketing ──────────────────────────────────────────────
  {
    id: 'mkt-1',
    category: 'marketing',
    question: 'How do I create marketing materials?',
    answer:
      'Go to the Marketing section from the sidebar. You can create flyers, social media posts, and email campaigns for your estate sales using our AI-powered templates.',
    minTier: 'free',
  },
  {
    id: 'mkt-2',
    category: 'marketing',
    question: 'Can I customize marketing templates?',
    answer:
      'Yes. Select a template and customize the colors, images, text, and layout. Pro and Enterprise plans have access to premium templates and advanced customization options.',
    minTier: 'free',
  },

  // ── Clients ─────────────────────────────────────────────────
  {
    id: 'cli-1',
    category: 'clients',
    question: 'How do I add a new client?',
    answer:
      'Go to the Clients page from the sidebar and click "Add Client". Fill in the client\'s name, contact information, and address. You can also use address autocomplete for faster entry.',
    minTier: 'free',
  },
  {
    id: 'cli-2',
    category: 'clients',
    question: 'What are the client onboarding stages?',
    answer:
      'Clients progress through five stages: Invited → Onboarding → Active → Completed → Archived. Each stage is tracked visually on the client\'s detail page so you always know where things stand.',
    minTier: 'free',
  },
  {
    id: 'cli-3',
    category: 'clients',
    question: 'How do Frequent Buyer suggestions work?',
    answer:
      'Our AI analyzes purchase history and engagement to identify clients who are likely repeat buyers. Check the Frequent Buyers tab on the Clients page for personalized recommendations.',
    minTier: 'pro',
  },

  // ── Contracts ───────────────────────────────────────────────
  {
    id: 'ctr-1',
    category: 'contracts',
    question: 'How do I send a contract for signature?',
    answer:
      'Create a contract from the Contracts page, fill in the terms, and click "Send". The client will receive a secure DocuSeal link to review and sign the contract electronically.',
    minTier: 'free',
  },
  {
    id: 'ctr-2',
    category: 'contracts',
    question: 'What happens when a client declines a contract?',
    answer:
      'You\'ll receive a notification when a client declines. The contract status updates to "Declined" on your dashboard. You can create a new contract with revised terms and send it again.',
    minTier: 'free',
  },
  {
    id: 'ctr-3',
    category: 'contracts',
    question: 'Can I edit a contract after sending it?',
    answer:
      'Once a contract is sent, it cannot be edited. If changes are needed, void the existing contract and create a new one with updated terms. Voided contracts are preserved in your records.',
    minTier: 'free',
  },
  {
    id: 'ctr-4',
    category: 'contracts',
    question: 'How do contract templates work?',
    answer:
      'Templates let you define reusable document structures and default terms. Create a template once, then select it when creating new contracts to save time. Pro and Enterprise plans have access to template management.',
    minTier: 'pro',
  },

  // ── Troubleshooting ────────────────────────────────────────
  {
    id: 'ts-1',
    category: 'troubleshooting',
    question: 'Image processing seems stuck. What should I do?',
    answer:
      'Image processing usually completes within a few minutes. If an item shows "processing" for more than 10 minutes, try re-uploading the image. If the issue persists, submit a support ticket.',
    minTier: 'free',
  },
  {
    id: 'ts-2',
    category: 'troubleshooting',
    question: 'I can\'t see my organization after being invited.',
    answer:
      'Check your Notifications page for a pending invitation. You need to accept the invite before you can switch to that organization. If you don\'t see an invitation, ask the admin to resend it.',
    minTier: 'free',
  },
  {
    id: 'ts-3',
    category: 'troubleshooting',
    question: 'How do I contact priority support?',
    answer:
      'Enterprise plan members can submit high-priority tickets from the Help Center. Priority tickets receive a guaranteed faster response time and dedicated support.',
    minTier: 'enterprise',
  },
  {
    id: 'ts-4',
    category: 'troubleshooting',
    question: 'I received a warning about "unusual invitation activity". What does this mean?',
    answer:
      'Our fair-use system detected an uncommon pattern such as sending many invitations in a short time or repeatedly inviting and removing the same person. A warning is informational only and does not block any actions. If the pattern continues, invitations may be temporarily paused. Contact support if you believe this was triggered by mistake.',
    minTier: 'free',
  },
  {
    id: 'ts-5',
    category: 'troubleshooting',
    question: 'Invitations are blocked and I see a "cooldown" or "lock" message. How do I fix this?',
    answer:
      'A cooldown (24 hours) or temporary lock (72 hours) is applied when our system detects repeated patterns that look like seat-sharing abuse. The restriction lifts automatically after the period ends. If you believe this is an error, contact our support team with your organization name and we\'ll review it right away.',
    minTier: 'free',
  },
  {
    id: 'bill-4',
    category: 'billing',
    question: 'What is the account sharing policy?',
    answer:
      'Each seat on your plan is for one individual team member. Sharing login credentials or rapidly cycling members in and out to bypass your seat limit is not allowed. We enforce this with a progressive system — first a warning, then a temporary cooldown, and finally a short lock. Upgrade to a higher plan if you need more seats.',
    minTier: 'free',
  },
];

/** Return FAQs visible to the given tier, optionally filtered by category. */
export function getFaqs(
  tier: SubscriptionTier = 'free',
  category?: FaqCategory
): FaqItem[] {
  return FAQS.filter((faq) => {
    if (category && faq.category !== category) return false;
    return isTierAtLeast(tier, faq.minTier);
  });
}

/** Search FAQs by query string (case-insensitive match on question + answer). */
export function searchFaqs(
  query: string,
  tier: SubscriptionTier = 'free'
): FaqItem[] {
  const lower = query.toLowerCase();
  return FAQS.filter((faq) => {
    if (!isTierAtLeast(tier, faq.minTier)) return false;
    return (
      faq.question.toLowerCase().includes(lower) ||
      faq.answer.toLowerCase().includes(lower)
    );
  });
}
