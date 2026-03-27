import { handleCallback } from '@vercel/queue';
import {
  processWelcomeEmailDelivery,
  type WelcomeEmailQueuePayload,
} from '@/app/onboarding/actions';

export const POST = handleCallback<WelcomeEmailQueuePayload>(processWelcomeEmailDelivery, {
  visibilityTimeoutSeconds: 30,
});
