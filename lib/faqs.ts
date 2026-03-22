import type { SubscriptionTier } from '@/lib/tiers';

export type FaqCategory = 'getting-started' | 'billing' | 'inventory' | 'marketing' | 'troubleshooting';

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
