// Feature gating utility for Curator pricing tiers

import { SubscriptionTier } from '@/lib/tiers';

export type Feature =
  | 'basic-ai'
  | 'advanced-ai'
  | 'stripe-integration'
  | 'multi-member-org'
  | 'priority-support'
  | 'custom-integrations'
  | 'advanced-analytics';

// Feature matrix: tier -> allowed features
const featureMatrix: Record<SubscriptionTier, Feature[]> = {
  free: [
    'basic-ai',
  ],
  pro: [
    'basic-ai',
    'advanced-ai',
    'stripe-integration',
    'multi-member-org',
  ],
  enterprise: [
    'basic-ai',
    'advanced-ai',
    'stripe-integration',
    'multi-member-org',
    'priority-support',
    'custom-integrations',
    'advanced-analytics',
  ],
};

/**
 * Check if a subscription tier has access to a specific feature
 * @param tier - The subscription tier
 * @param feature - The feature to check
 * @returns true if the tier has access to the feature, false otherwise
 */
export function canUseFeature(tier: SubscriptionTier, feature: Feature): boolean {
  return featureMatrix[tier].includes(feature);
}

/**
 * Get all features available for a subscription tier
 * @param tier - The subscription tier
 * @returns Array of available features
 */
export function getAvailableFeatures(tier: SubscriptionTier): Feature[] {
  return [...featureMatrix[tier]];
}

/**
 * Check multiple features at once
 * @param tier - The subscription tier
 * @param features - Array of features to check
 * @returns true if the tier has access to all features, false otherwise
 */
export function canUseAllFeatures(tier: SubscriptionTier, features: Feature[]): boolean {
  return features.every(feature => canUseFeature(tier, feature));
}

/**
 * Get feature descriptions for user-facing messages
 */
export function getFeatureDescription(feature: Feature): string {
  const descriptions: Record<Feature, string> = {
    'basic-ai': 'Basic AI-powered insights',
    'advanced-ai': 'Advanced AI and machine learning features',
    'stripe-integration': 'Stripe account integration for payments',
    'multi-member-org': 'Add multiple team members to your organization',
    'priority-support': 'Priority customer support',
    'custom-integrations': 'Custom API integrations',
    'advanced-analytics': 'Advanced analytics and reporting',
  };
  return descriptions[feature] || feature;
}
