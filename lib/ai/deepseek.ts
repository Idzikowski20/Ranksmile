import { createDeepSeek } from '@ai-sdk/deepseek';

/** Shared DeepSeek provider for the Surfy agent. Reads DEEPSEEK_API_KEY. */
export const deepseek = createDeepSeek({ apiKey: process.env.DEEPSEEK_API_KEY });
