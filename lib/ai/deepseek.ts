import { createDeepSeek } from '@ai-sdk/deepseek';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

/**
 * TEMP switch: Gemini 3.6 Flash instead of DeepSeek for Ranksmile chat / agent / OpenAI-compat fetches.
 * Set to `false` to restore DeepSeek. Needs GEMINI_API_KEY (or GOOGLE_GENERATIVE_AI_API_KEY).
 * Model: gemini-2.5-flash is blocked for new AI Studio keys → use gemini-3.6-flash.
 */
export const USE_GEMINI_FLASH = true;

const GEMINI_FLASH_MODEL = 'gemini-3.6-flash';

const deepseekProvider = createDeepSeek({ apiKey: process.env.DEEPSEEK_API_KEY });
const googleProvider = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY,
});

/** Drop-in for `deepseek('deepseek-chat')` — model id ignored while Gemini is on. */
export function deepseek(modelId: string = 'deepseek-chat') {
  if (USE_GEMINI_FLASH) return googleProvider(GEMINI_FLASH_MODEL);
  return deepseekProvider(modelId);
}

export type ChatLlmConfig = {
  provider: 'gemini' | 'deepseek';
  apiKey: string;
  keyEnv: string;
  model: string;
  /** OpenAI-compatible chat completions URL */
  url: string;
};

/** Shared config for raw `fetch(.../chat/completions)` call sites. */
export function chatLlm(): ChatLlmConfig {
  if (USE_GEMINI_FLASH) {
    return {
      provider: 'gemini',
      apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY || '',
      keyEnv: 'GEMINI_API_KEY',
      model: GEMINI_FLASH_MODEL,
      url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    };
  }
  return {
    provider: 'deepseek',
    apiKey: process.env.DEEPSEEK_API_KEY || '',
    keyEnv: 'DEEPSEEK_API_KEY',
    model: 'deepseek-chat',
    url: 'https://api.deepseek.com/v1/chat/completions',
  };
}
