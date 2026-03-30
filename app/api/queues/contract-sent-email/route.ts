import { handleCallback } from '@vercel/queue';
import {
  processContractSentEmailDelivery,
  type ContractSentEmailQueuePayload,
} from '@/app/onboarding/actions';

export const POST = handleCallback<ContractSentEmailQueuePayload>(processContractSentEmailDelivery, {
  visibilityTimeoutSeconds: 30,
});
