import { handleCallback } from '@vercel/queue';
import {
  processContractWebhook,
  type ContractWebhookPayload,
} from '@/lib/onboarding-webhook-processors';

export const POST = handleCallback<ContractWebhookPayload>(processContractWebhook, {
  visibilityTimeoutSeconds: 30,
});
