/**
 * LLM Gateway — single entry for provider calls (retry, fallback, cost telemetry).
 * Workers MUST NOT call OpenAI/Anthropic/DeepSeek directly.
 */
import { ensurePipelineJobsTables } from './ensurePipelineJobsTables';
import db from '../database/database';
import { chatLlm } from './ai/deepseek';

export type LlmProvider = 'deepseek' | 'openai' | 'anthropic' | 'ollama' | 'gemini' | 'openrouter';

export type LlmGatewayRequest = {
  provider?: LlmProvider;
  fallbackProviders?: LlmProvider[];
  model?: string;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  temperature?: number;
  maxTokens?: number;
  seed?: number;
  responseFormat?: 'json_object' | 'text';
  jobKey?: string;
  workspaceId?: string;
  keyword?: string;
  jobType?: string;
  /** Max attempts including first try. */
  maxAttempts?: number;
};

export type LlmGatewayResponse = {
  text: string;
  provider: LlmProvider;
  model: string;
  estimatedCost: number;
  actualCost: number;
  attempts: number;
};

const MODEL_DEFAULTS: Record<LlmProvider, string> = {
  deepseek: 'deepseek-chat',
  gemini: 'gemini-3.6-flash',
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-5-haiku-latest',
  ollama: 'llama3.2',
  openrouter: 'openai/gpt-5.6-luna',
};

/** Rough USD estimate — telemetry only, not billing. */
export function estimateLlmCost(provider: LlmProvider, promptChars: number, completionChars: number): number {
  const tokens = (promptChars + completionChars) / 4;
  const rates: Record<LlmProvider, number> = {
    deepseek: 0.0000003,
    gemini: 0.0000003,
    openai: 0.0000005,
    anthropic: 0.000001,
    ollama: 0,
    openrouter: 0.0000005,
  };
  return Math.round(tokens * (rates[provider] ?? 0.0000005) * 1e6) / 1e6;
}

async function recordCost(opts: {
  jobKey?: string;
  workspaceId?: string;
  keyword?: string;
  jobType?: string;
  provider: string;
  estimatedCost: number;
  actualCost: number;
  durationMs: number;
  cacheHit?: boolean;
}): Promise<void> {
  try {
    await ensurePipelineJobsTables();
    await db.query(
      `INSERT INTO pipeline_cost_events
        (job_key, workspace_id, keyword, job_type, provider, estimated_cost, actual_cost, cache_hit, duration_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      {
        replacements: [
          opts.jobKey ?? null,
          opts.workspaceId ?? null,
          opts.keyword ?? null,
          opts.jobType ?? null,
          opts.provider,
          opts.estimatedCost,
          opts.actualCost,
          opts.cacheHit ? 1 : 0,
          opts.durationMs,
        ],
      },
    );
  } catch (err: unknown) {
    console.warn('[llmGateway] cost telemetry failed:', err);
  }
}

async function callProvider(
  provider: LlmProvider,
  model: string,
  messages: LlmGatewayRequest['messages'],
  temperature: number,
  maxTokens: number,
  opts?: { seed?: number; responseFormat?: 'json_object' | 'text' },
): Promise<string> {
  if (provider === 'deepseek' || provider === 'openai' || provider === 'gemini' || provider === 'openrouter') {
    // Node chat path: always OpenRouter GPT (chatLlm). Provider arg kept for telemetry labels.
    const resolved = chatLlm();
    const key = resolved.apiKey;
    if (!key) throw new Error(`${resolved.keyEnv} not configured`);
    const body: Record<string, unknown> = {
      model: resolved.model || model,
      messages,
      temperature,
      max_tokens: maxTokens,
    };
    if (opts?.seed != null) body.seed = opts.seed;
    if (opts?.responseFormat === 'json_object') {
      body.response_format = { type: 'json_object' };
    }
    const res = await fetch(resolved.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://ranksmile.pl',
        'X-Title': 'Ranksmile',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`${resolved.provider} HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return data.choices?.[0]?.message?.content?.trim() || '';
  }
  if (provider === 'anthropic') {
    const key = process.env.ANTHROPIC_API_KEY || '';
    if (!key) throw new Error('anthropic API key not configured');
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        temperature,
        messages: messages.filter((m) => m.role !== 'system'),
        system: messages.find((m) => m.role === 'system')?.content,
      }),
    });
    if (!res.ok) throw new Error(`anthropic HTTP ${res.status}`);
    const data = (await res.json()) as { content?: Array<{ text?: string }> };
    return data.content?.[0]?.text?.trim() || '';
  }
  throw new Error(`provider ${provider} not supported in gateway`);
}

export async function llmGateway(req: LlmGatewayRequest): Promise<LlmGatewayResponse> {
  const chain: LlmProvider[] = [
    req.provider || 'openrouter',
    ...(req.fallbackProviders || []),
  ].filter((p, i, a) => a.indexOf(p) === i);

  const maxAttempts = Math.max(1, req.maxAttempts ?? 2);
  const promptChars = req.messages.reduce((s, m) => s + m.content.length, 0);
  const temperature = req.temperature ?? 0.2;
  const maxTokens = req.maxTokens ?? 2000;
  const t0 = Date.now();
  let lastErr: unknown;
  let attempts = 0;

  for (const provider of chain) {
    const model = req.model || MODEL_DEFAULTS[provider];
    for (let i = 0; i < maxAttempts; i++) {
      attempts += 1;
      try {
        const text = await callProvider(provider, model, req.messages, temperature, maxTokens, {
          seed: req.seed,
          responseFormat: req.responseFormat,
        });
        const actualCost = estimateLlmCost(provider, promptChars, text.length);
        const estimatedCost = estimateLlmCost(provider, promptChars, maxTokens * 4);
        await recordCost({
          jobKey: req.jobKey,
          workspaceId: req.workspaceId,
          keyword: req.keyword,
          jobType: req.jobType,
          provider,
          estimatedCost,
          actualCost,
          durationMs: Date.now() - t0,
        });
        return { text, provider, model, estimatedCost, actualCost, attempts };
      } catch (err: unknown) {
        lastErr = err;
        await new Promise((r) => setTimeout(r, 200 * 2 ** i));
      }
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}
