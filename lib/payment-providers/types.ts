/**
 * Payment provider abstraction types.
 *
 * Each supported provider (Stripe, Square, Clover) implements a common
 * connection lifecycle used by settings UI + checkout dispatch.
 */

export type PaymentProvider = 'stripe' | 'square' | 'clover';

export type ConnectionStatus = 'pending' | 'connected' | 'incomplete' | 'error' | 'disconnected';

export interface ProviderConnection {
  id: string;
  orgId: string;
  provider: PaymentProvider;
  externalAccountId: string;
  status: ConnectionStatus;
  onboardingComplete: boolean;
  isDefault: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderConnectionStatus {
  provider: PaymentProvider;
  connected: boolean;
  onboardingComplete: boolean;
  externalAccountId: string | null;
  isDefault: boolean;
  requirements?: {
    currentlyDue: string[];
    errors: string[];
  } | null;
  dashboardUrl?: string;
}

export interface ProviderDisplayInfo {
  provider: PaymentProvider;
  name: string;
  description: string;
  icon: string; // lucide icon name
  brandColor: string;
  darkBrandColor: string;
  dashboardUrl: string | null;
  oauthSupported: boolean;
}

// ── Checkout types ──────────────────────────────────────────

export type ProviderAccount = {
  provider: PaymentProvider;
  externalAccountId: string;
  accessToken: string | null;
  orgId: string;
};

export type CheckoutLineItem = {
  name: string;
  description: string | null;
  unitAmountCents: number;
  quantity: number;
  imageUrl: string | null;
};

export type CheckoutResult = {
  url: string;
  providerSessionId: string;
};

// ── Refund types ────────────────────────────────────────────

export type RefundInput = {
  providerPaymentId: string;
  amountCents?: number;
  reason?: string;
};

export type RefundResult = {
  refundId: string;
  status: 'pending' | 'succeeded' | 'failed';
  amountCents: number;
};

// ── Payment status types ────────────────────────────────────

export type PaymentStatusResult = {
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  providerPaymentId: string;
  amountCents: number;
  currency: string;
  metadata: Record<string, unknown>;
};

// ── Provider display config ─────────────────────────────────

export const PROVIDER_DISPLAY: Record<PaymentProvider, ProviderDisplayInfo> = {
  stripe: {
    provider: 'stripe',
    name: 'Stripe',
    description: 'Accept card payments and receive direct payouts.',
    icon: 'CreditCard',
    brandColor: 'text-violet-600',
    darkBrandColor: 'dark:text-violet-400',
    dashboardUrl: 'https://dashboard.stripe.com',
    oauthSupported: true,
  },
  square: {
    provider: 'square',
    name: 'Square',
    description: 'Process payments via Square POS and online checkout.',
    icon: 'SquareStack',
    brandColor: 'text-stone-900',
    darkBrandColor: 'dark:text-white',
    dashboardUrl: 'https://squareup.com/dashboard',
    oauthSupported: true,
  },
  clover: {
    provider: 'clover',
    name: 'Clover',
    description: 'Connect your Clover POS for in-person and online sales.',
    icon: 'Store',
    brandColor: 'text-emerald-700',
    darkBrandColor: 'dark:text-emerald-400',
    dashboardUrl: 'https://www.clover.com/dashboard',
    oauthSupported: true,
  },
};

export const ALL_PROVIDERS: PaymentProvider[] = ['stripe', 'square', 'clover'];
