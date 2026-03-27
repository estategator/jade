import { handleCallback } from '@vercel/queue';
import {
  processContractWebhook,
  type ContractWebhookPayload,
} from '@/app/onboarding/actions';

export const POST = handleCallback<ContractWebhookPayload>(processContractWebhook, {
  visibilityTimeoutSeconds: 30,
});
