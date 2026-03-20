// Pricing tier system for Curator
// Free: limited features, 1 member
// Pro: full AI features, 5 members, Stripe integration
// Enterprise: unlimited members, custom features

export type SubscriptionTier = 'free' | 'pro' | 'enterprise';

export interface TierFeature {
  label: string;
  included: boolean;
  description?: string;
}

export interface PricingTier {
  id: SubscriptionTier;
  name: string;
  description: string;
  price: number;
  pricingPeriod: 'month' | 'year';
  memberLimit: number;
  features: TierFeature[];
  stripeProductId?: string;
  stripePriceId?: string;
  popular?: boolean;
}

export const TIERS: Record<SubscriptionTier, PricingTier> = {
  free: {
    id: 'free',
    name: 'Free',
    description: 'Perfect for getting started',
    price: 0,
    pricingPeriod: 'month',
    memberLimit: 1,
    features: [
      { label: 'Up to 1 team member', included: true },
      { label: 'Basic AI insights', included: true, description: 'Essential AI-powered item valuations' },
      { label: 'Image processing', included: true },
      { label: 'Inventory management', included: true },
      { label: 'Advanced AI features', included: false },
      { label: 'Stripe account integration', included: false },
      { label: 'Team collaboration (5+)', included: false },
      { label: 'Priority support', included: false },
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    description: 'For growing teams',
    price: 50,
    pricingPeriod: 'month',
    memberLimit: 5,
    features: [
      { label: 'Up to 5 team members', included: true },
      { label: 'Basic AI insights', included: true },
      { label: 'Advanced AI features', included: true, description: 'Enhanced market analysis & predictions' },
      { label: 'Image processing', included: true },
      { label: 'Inventory management', included: true },
      { label: 'Stripe account integration', included: true, description: 'Connect Stripe for payments' },
      { label: 'Team collaboration (5+)', included: false },
      { label: 'Priority support', included: false },
    ],
    popular: true,
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'For large organizations',
    price: 0, // Custom pricing
    pricingPeriod: 'month',
    memberLimit: Infinity, // Unlimited
    features: [
      { label: 'Unlimited team members', included: true },
      { label: 'Basic AI insights', included: true },
      { label: 'Advanced AI features', included: true },
      { label: 'Image processing', included: true },
      { label: 'Inventory management', included: true },
      { label: 'Stripe account integration', included: true },
      { label: 'Team collaboration (5+)', included: true },
      { label: 'Priority support', included: true, description: '24/7 dedicated support' },
      { label: 'Custom integrations', included: true },
      { label: 'Advanced analytics', included: true },
    ],
  },
};

// ── Stripe price → internal tier mapping ─────────────────────

// Maps Stripe Price IDs (from env) to internal tier names.
// Only self-serve tiers are included; Enterprise is sales-led.
const STRIPE_PRICE_TO_TIER: Record<string, SubscriptionTier> = {};

function initPriceMap() {
  const proPriceId = process.env.STRIPE_PRO_PRICE_ID;
  if (proPriceId) STRIPE_PRICE_TO_TIER[proPriceId] = 'pro';
}
initPriceMap();

/**
 * Resolve a Stripe Price ID to the internal subscription tier.
 * Returns undefined if the price ID is unknown.
 */
export function tierFromStripePriceId(priceId: string): SubscriptionTier | undefined {
  return STRIPE_PRICE_TO_TIER[priceId];
}

// Helper function to get member limit for tier
export function getMemberLimit(tier: SubscriptionTier): number {
  return TIERS[tier].memberLimit;
}

// Helper function to check if tier is unlimited
export function isUnlimitedTier(tier: SubscriptionTier): boolean {
  return TIERS[tier].memberLimit === Infinity;
}

// Helper function to format price
export function formatPrice(price: number): string {
  if (price === 0) return 'Custom pricing';
  return `$${price}`;
}
