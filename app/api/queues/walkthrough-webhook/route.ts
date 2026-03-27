import { handleCallback } from '@vercel/queue';
import {
  processWalkthroughWebhook,
  type WalkthroughWebhookPayload,
} from '@/app/onboarding/actions';

export const POST = handleCallback<WalkthroughWebhookPayload>(processWalkthroughWebhook, {
  visibilityTimeoutSeconds: 30,
});
