/**
 * DataForSEO client for AI Visibility — one prompt → one answer + web citations
 * per AI engine. Five engines, two DFS product families:
 *   chat_gpt | perplexity | gemini → /v3/ai_optimization/{engine}/llm_responses/live
 *   ai_mode                        → /v3/serp/google/ai_mode/live/advanced
 *   ai_overview                    → /v3/serp/google/organic/live/advanced (ai_overview element)
 * All engines normalise to { text, citations:[{url,domain,title}], costUsd }.
 * Docs: docs.dataforseo.com/v3/ai_optimization/* and /v3/serp/google/{ai_mode,organic}/live/advanced
 */
import axios from 'axios';
import { isDataForSeoConfigured } from './dataforseo';
import { DFS_SERP_AI_ELEMENT } from './dataforseoBudget';

const BASE = 'https://api.dataforseo.com/v3';

export type AiModel = 'ai_overview' | 'ai_mode' | 'chat_gpt' | 'perplexity' | 'gemini';
export type LlmCitation = { url: string, domain: string, title: string };
export type LlmAnswer = { text: string, citations: LlmCitation[], fanOutQueries: string[], costUsd: number };

/** llm_responses/live is only for these three; the two Google engines route to SERP. */
const LLM_ENGINES: AiModel[] = ['chat_gpt', 'perplexity', 'gemini'];

/** Default model_name per llm_responses engine — verified via scripts/probe-dfs-llm.js. */
const MODEL_NAME: Record<'chat_gpt' | 'perplexity' | 'gemini', string> = {
   chat_gpt: 'gpt-4.1-mini',
   gemini: 'gemini-2.5-flash',
   perplexity: 'sonar',
};

// Google geo/lang defaults — reuse the PL market the rest of the app targets.
const LOCATION_CODE_PL = 2616;

const authHeader = (): string => {
   const login = process.env.DATAFORSEO_LOGIN || '';
   const password = process.env.DATAFORSEO_PASSWORD || '';
   return `Basic ${Buffer.from(`${login}:${password}`).toString('base64')}`;
};

const domainFromUrl = (url: string): string => {
   try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
};

const asCitation = (url: unknown, title: unknown, domain?: unknown): LlmCitation | null => {
   if (typeof url !== 'string' || !url) return null;
   return {
      url,
      title: typeof title === 'string' ? title : '',
      domain: typeof domain === 'string' && domain ? domain.replace(/^www\./, '') : domainFromUrl(url),
   };
};

/** Transient HTTP statuses worth retrying — 429 rate-limit + 5xx + network/timeout. */
export const isRetryable = (e: unknown): boolean => {
   const err = e as { response?: { status?: number }, code?: string };
   const status = err?.response?.status;
   if (status && (status === 429 || status >= 500)) return true;
   if (status && status >= 400 && status < 500) return false;
   return err?.code === 'ECONNABORTED' || err?.code === 'ETIMEDOUT' || err?.code === 'ECONNRESET';
};

const sleep = (ms: number): Promise<void> => new Promise((r) => { setTimeout(r, ms); });

/**
 * Fan-out sub-queries the engine generated while answering. llm_responses expose
 * `result[0].fan_out_queries` (string[], populated when web_search actually ran);
 * the Google `ai_mode` SERP exposes `refinement_chips` (string or {title}). Others
 * (perplexity/ai_overview) return none → []. Pure + exported for unit tests.
 */
export function extractFanOut(result: unknown): string[] {
   const r = result as { fan_out_queries?: unknown, refinement_chips?: unknown } | null;
   const raw = r?.fan_out_queries ?? r?.refinement_chips;
   if (!Array.isArray(raw)) return [];
   const out: string[] = [];
   for (const q of raw) {
      const s = typeof q === 'string'
         ? q
         : (q && typeof q === 'object'
            ? String((q as { title?: unknown, query?: unknown }).title ?? (q as { query?: unknown }).query ?? '')
            : '');
      const t = s.trim();
      if (t) out.push(t);
   }
   return out;
}

/** Pure parser for llm_responses result[0].items — exported for unit tests. */
export function parseLlmItems(items: unknown[]): { text: string, citations: LlmCitation[] } {
   let text = '';
   const citations: LlmCitation[] = [];
   for (const raw of Array.isArray(items) ? items : []) {
      const item = raw as { type?: string, sections?: Array<{ type?: string, text?: string, annotations?: Array<{ title?: string, url?: string }> }> } | null;
      if (!item || item.type !== 'message' || !Array.isArray(item.sections)) continue;
      for (const section of item.sections) {
         if (section?.type !== 'text') continue;
         if (section.text) text += (text ? '\n' : '') + section.text;
         for (const a of section.annotations ?? []) {
            const c = asCitation(a?.url, a?.title);
            if (c) citations.push(c);
         }
      }
   }
   return { text, citations };
}

/** Pure parser for the SERP `ai_mode` element (serp/google/ai_mode). */
export function parseAiModeItems(items: unknown[]): { text: string, citations: LlmCitation[] } {
   let text = '';
   const citations: LlmCitation[] = [];
   for (const raw of Array.isArray(items) ? items : []) {
      const item = raw as {
         markdown?: string, text?: string,
         references?: Array<{ url?: string, title?: string, domain?: string }>,
         links?: Array<{ url?: string, title?: string, domain?: string }>,
      } | null;
      if (!item) continue;
      if (item.text) text += (text ? '\n' : '') + item.text;
      else if (item.markdown) text += (text ? '\n' : '') + item.markdown;
      for (const r of [...(item.references ?? []), ...(item.links ?? [])]) {
         const c = asCitation(r?.url, r?.title, r?.domain);
         if (c) citations.push(c);
      }
   }
   return { text, citations };
}

/** Pure parser for the `ai_overview` element inside a Google organic SERP. */
export function parseAiOverview(items: unknown[]): { text: string, citations: LlmCitation[] } {
   let text = '';
   const citations: LlmCitation[] = [];
   for (const raw of Array.isArray(items) ? items : []) {
      const item = raw as {
         type?: string, markdown?: string,
         references?: Array<{ url?: string, title?: string, domain?: string }>,
         items?: Array<{ text?: string, title?: string, url?: string, domain?: string, links?: Array<{ url?: string, title?: string, domain?: string }> }>,
      } | null;
      if (!item || item.type !== 'ai_overview') continue;
      if (item.markdown) text += (text ? '\n' : '') + item.markdown;
      for (const sub of item.items ?? []) {
         if (sub?.text) text += (text ? '\n' : '') + sub.text;
         const direct = asCitation(sub?.url, sub?.title, sub?.domain);
         if (direct) citations.push(direct);
         for (const l of sub?.links ?? []) {
            const c = asCitation(l?.url, l?.title, l?.domain);
            if (c) citations.push(c);
         }
      }
      for (const r of item.references ?? []) {
         const c = asCitation(r?.url, r?.title, r?.domain);
         if (c) citations.push(c);
      }
   }
   return { text, citations };
}

type DfsTaskPayload = {
   status_code?: number,
   status_message?: string,
   cost?: number,
   result?: Array<{ items?: unknown[], fan_out_queries?: unknown, refinement_chips?: unknown }>,
};

async function postWithRetry(path: string, task: Record<string, unknown>): Promise<{ taskData: DfsTaskPayload, costUsd: number }> {
   const MAX_ATTEMPTS = 3;
   let lastErr: unknown;
   for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      try {
         const res = await axios.post(`${BASE}${path}`, [task], {
            headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
            timeout: 120000,
         });
         if (res.data?.status_code !== 20000) {
            throw new Error(`DataForSEO API ${res.data?.status_code}: ${res.data?.status_message}`);
         }
         const taskData = res.data?.tasks?.[0];
         if (taskData?.status_code !== 20000) {
            throw new Error(`DataForSEO task ${taskData?.status_code}: ${taskData?.status_message}`);
         }
         return { taskData, costUsd: Number(taskData?.cost ?? 0) };
      } catch (e) {
         lastErr = e;
         if (attempt >= MAX_ATTEMPTS || !isRetryable(e)) break;
         await sleep(1000 * 2 ** (attempt - 1)); // 1s, 2s
      }
   }
   throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

/**
 * Run one prompt against one AI engine, routing to the right DFS product, and
 * return normalised { text, citations, costUsd }. Retries 3× (1s/2s) on
 * 429/5xx/timeout; never retries 4xx. `countryIso` scopes the LLM web search.
 */
export async function runModelPrompt(model: AiModel, prompt: string, countryIso = 'PL'): Promise<LlmAnswer> {
   if (!isDataForSeoConfigured()) {
      throw new Error('DataForSEO not configured — set DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD.');
   }

   if (LLM_ENGINES.includes(model)) {
      const task: Record<string, unknown> = {
         user_prompt: prompt.slice(0, 500),
         model_name: MODEL_NAME[model as 'chat_gpt' | 'perplexity' | 'gemini'],
         max_output_tokens: 1024,
         web_search: true,
      };
      // Gemini's llm_responses rejects web_search_country_iso_code (40501 Invalid
      // Field); only chat_gpt/perplexity accept geo-scoping the web search.
      if (model !== 'gemini') task.web_search_country_iso_code = countryIso.toUpperCase();
      const { taskData, costUsd } = await postWithRetry(`/ai_optimization/${model}/llm_responses/live`, task);
      const result = taskData?.result?.[0];
      const parsed = parseLlmItems(result?.items ?? []);
      return { ...parsed, fanOutQueries: extractFanOut(result), costUsd };
   }

   if (model === 'ai_mode') {
      const task: Record<string, unknown> = {
         keyword: prompt.slice(0, 700),
         location_code: LOCATION_CODE_PL,
         language_code: 'pl',
         ...DFS_SERP_AI_ELEMENT,
      };
      const { taskData, costUsd } = await postWithRetry('/serp/google/ai_mode/live/advanced', task);
      const result = taskData?.result?.[0];
      const parsed = parseAiModeItems(result?.items ?? []);
      return { ...parsed, fanOutQueries: extractFanOut(result), costUsd };
   }

   // ai_overview: pull it from a normal Google organic SERP (page 1 only).
   const task: Record<string, unknown> = {
      keyword: prompt.slice(0, 700),
      location_code: LOCATION_CODE_PL,
      language_code: 'pl',
      ...DFS_SERP_AI_ELEMENT,
   };
   const { taskData, costUsd } = await postWithRetry('/serp/google/organic/live/advanced', task);
   const parsed = parseAiOverview(taskData?.result?.[0]?.items ?? []);
   return { ...parsed, fanOutQueries: [], costUsd }; // ai_overview exposes no fan-out
}
