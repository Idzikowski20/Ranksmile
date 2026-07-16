import { getPeopleAlsoAsk, isDataForSeoConfigured } from '../dataforseo';
import { fetchLlmCoverageQuestions, type LlmCoverageQuestion, type LlmCoverageSource } from '../llmCoverageQuestions';
import { isKeywordOnTopic } from '../topicRelevance';
import { isUsefulCitationPrompt } from '../citationPrompts';

export type ProviderContext = {
  keyword: string;
  country?: string;
  languageCode?: string;
  /** Pre-fetched Serper/SERP PAA (preferred over live DFS call). */
  paaQuestions?: Array<{ question: string; domain?: string }>;
};

export type ProviderResult = {
  provider: string;
  latencyMs: number;
  questions: LlmCoverageQuestion[];
  /** Weight override for scoring (e.g. PAA = 3). */
  weightHint?: number;
  errors?: string[];
};

export type CoverageProvider = {
  id: string;
  fetch: (ctx: ProviderContext) => Promise<ProviderResult>;
};

function timed<T>(fn: () => Promise<T>): Promise<{ value: T; latencyMs: number; error?: string }> {
  const t0 = Date.now();
  return fn()
    .then((value) => ({ value, latencyMs: Date.now() - t0 }))
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      return {
        value: null as unknown as T,
        latencyMs: Date.now() - t0,
        error: message,
      };
    });
}

/** DataForSEO LLM fan-out (includes organic PAA inside fetch — dedupe later). */
export const dataforseoLlmProvider: CoverageProvider = {
  id: 'dataforseo_llm',
  async fetch(ctx) {
    const { value, latencyMs, error } = await timed(() =>
      fetchLlmCoverageQuestions({
        keyword: ctx.keyword,
        country: ctx.country,
        languageCode: ctx.languageCode,
      }),
    );
    if (error) {
      return { provider: this.id, latencyMs, questions: [], errors: [error] };
    }
    return { provider: this.id, latencyMs, questions: value || [] };
  },
};

/** SERP People Also Ask (Serper rows or live DFS). Weight hint = 3. */
export const serpPaaProvider: CoverageProvider = {
  id: 'serp_paa',
  async fetch(ctx) {
    const t0 = Date.now();
    const errors: string[] = [];
    let rows: Array<{ question: string; domain?: string }> = ctx.paaQuestions || [];

    if (!rows.length && isDataForSeoConfigured()) {
      try {
        const paa = await getPeopleAlsoAsk({
          keyword: ctx.keyword,
          country: ctx.country || 'PL',
          languageCode: ctx.languageCode || 'pl',
        });
        rows = paa.questions;
      } catch (err: unknown) {
        errors.push(err instanceof Error ? err.message : String(err));
      }
    }

    const questions: LlmCoverageQuestion[] = [];
    for (const q of rows) {
      const text = (q.question || '').replace(/\s+/g, ' ').trim();
      if (!text || text.length < 10) continue;
      if (!isUsefulCitationPrompt(text, ctx.keyword) && !isKeywordOnTopic(text, ctx.keyword)) continue;
      const sources: LlmCoverageSource[] = /reddit\.com/i.test(q.domain ?? '')
        ? ['reddit']
        : ['ai_overview'];
      questions.push({ question: text, sources });
    }

    return {
      provider: this.id,
      latencyMs: Date.now() - t0,
      questions,
      weightHint: 3,
      errors: errors.length ? errors : undefined,
    };
  },
};

export const DEFAULT_PROVIDERS: CoverageProvider[] = [
  dataforseoLlmProvider,
  serpPaaProvider,
];

/** Run all providers in parallel; never throws. */
export async function fetchAllProviders(
  ctx: ProviderContext,
  providers: CoverageProvider[] = DEFAULT_PROVIDERS,
): Promise<ProviderResult[]> {
  return Promise.all(providers.map((p) => p.fetch(ctx)));
}
