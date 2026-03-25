import 'server-only';
import { createOpenAI } from '@ai-sdk/openai';

export const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export const ANALYSIS_MODEL = 'gpt-5.4-nano' as const;
