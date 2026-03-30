import { handleCallback } from '@vercel/queue';
import {
  processClientPortalEmailDelivery,
  type ClientPortalEmailQueuePayload,
} from '@/app/onboarding/actions';

export const POST = handleCallback<ClientPortalEmailQueuePayload>(processClientPortalEmailDelivery, {
  visibilityTimeoutSeconds: 30,
});
