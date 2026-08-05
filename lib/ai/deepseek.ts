import { createDeepSeek } from '@ai-sdk/deepseek';

/**
 * Node LLM = OpenRouter GPT (same model as python-sidecar article generate).
 * Gemini / DeepSeek direct calls disabled for now.
 */
export const OPENROUTER_CHAT_MODEL = 'openai/gpt-5.6-luna';
export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

/** @deprecated Always false — kept so older imports compile. */
export const USE_GEMINI_FLASH = false;

const openrouterProvider = createDeepSeek({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: OPENROUTER_BASE_URL,
});

/**
 * Drop-in for `deepseek('deepseek-chat')` — model id ignored; always OpenRouter GPT.
 */
export function deepseek(_modelId: string = 'deepseek-chat') {
  void _modelId;
  return openrouterProvider(OPENROUTER_CHAT_MODEL);
}

export type ChatLlmConfig = {
  provider: 'openrouter';
  apiKey: string;
  keyEnv: string;
  model: string;
  /** OpenAI-compatible chat completions URL */
  url: string;
};

/** Shared config for raw `fetch(.../chat/completions)` call sites. */
export function chatLlm(): ChatLlmConfig {
  return {
    provider: 'openrouter',
    apiKey: process.env.OPENROUTER_API_KEY || '',
    keyEnv: 'OPENROUTER_API_KEY',
    model: OPENROUTER_CHAT_MODEL,
    url: `${OPENROUTER_BASE_URL}/chat/completions`,
  };
}
