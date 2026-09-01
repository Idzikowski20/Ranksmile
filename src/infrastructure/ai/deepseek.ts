import { createDeepSeek } from '@ai-sdk/deepseek';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

export const OPENROUTER_CHAT_MODEL = 'openai/gpt-5.6-luna';
export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
export const USE_GEMINI_FLASH = process.env.USE_GEMINI_FLASH === 'true';

const GEMINI_FLASH_MODEL = 'gemini-3.6-flash';
const hasOpenRouterKey = Boolean(process.env.OPENROUTER_API_KEY);
const deepseekProvider = createDeepSeek({ apiKey: process.env.DEEPSEEK_API_KEY });
const openrouterProvider = createDeepSeek({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: OPENROUTER_BASE_URL,
});
const googleProvider = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY,
});

/** OpenRouter is preferred when configured; legacy DeepSeek remains a safe default. */
export function deepseek(modelId: string = 'deepseek-chat') {
  if (hasOpenRouterKey) return openrouterProvider(OPENROUTER_CHAT_MODEL);
  if (USE_GEMINI_FLASH) return googleProvider(GEMINI_FLASH_MODEL);
  return deepseekProvider(modelId);
}

export type ChatLlmConfig = {
  provider: 'openrouter' | 'gemini' | 'deepseek';
  apiKey: string;
  keyEnv: string;
  model: string;
  /** OpenAI-compatible chat completions URL */
  url: string;
};

export function chatLlmFor(provider: ChatLlmConfig['provider']): ChatLlmConfig {
  if (provider === 'openrouter') {
    return {
      provider,
      apiKey: process.env.OPENROUTER_API_KEY || '',
      keyEnv: 'OPENROUTER_API_KEY',
      model: OPENROUTER_CHAT_MODEL,
      url: `${OPENROUTER_BASE_URL}/chat/completions`,
    };
  }
  if (provider === 'deepseek') {
    return {
      provider,
      apiKey: process.env.DEEPSEEK_API_KEY || '',
      keyEnv: 'DEEPSEEK_API_KEY',
      model: 'deepseek-chat',
      url: 'https://api.deepseek.com/v1/chat/completions',
    };
  }
  return {
    provider,
    apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY || '',
    keyEnv: 'GEMINI_API_KEY',
    model: GEMINI_FLASH_MODEL,
    url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
  };
}

/** Shared config for raw `fetch(.../chat/completions)` call sites. */
export function chatLlm(): ChatLlmConfig {
  if (hasOpenRouterKey) return chatLlmFor('openrouter');
  if (process.env.DEEPSEEK_API_KEY) return chatLlmFor('deepseek');
  return chatLlmFor('gemini');
}
