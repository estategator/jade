import { handleCallback } from '@vercel/queue';
import {
  processWalkthroughWebhook,
  type WalkthroughWebhookPayload,
} from '@/lib/onboarding-webhook-processors';

export const POST = handleCallback<WalkthroughWebhookPayload>(processWalkthroughWebhook, {
  visibilityTimeoutSeconds: 30,
});
