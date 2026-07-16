import type { LlmCoverageSource } from '../llmCoverageQuestions';

/** Serper PAA weight (not a LlmCoverageSource id — mapped at merge). */
export const PAA_SOURCE_WEIGHT = 3;

export const SOURCE_WEIGHT: Record<LlmCoverageSource, number> = {
  ai_overview: 5,
  chat_gpt: 4,
  gemini: 4,
  perplexity: 4,
  reddit: 2,
};

export function sourceWeight(src: LlmCoverageSource | 'paa'): number {
  if (src === 'paa') return PAA_SOURCE_WEIGHT;
  return SOURCE_WEIGHT[src] ?? 1;
}

export function maxSourceWeight(sources: readonly (LlmCoverageSource | 'paa')[]): number {
  if (!sources.length) return 1;
  return Math.max(...sources.map(sourceWeight));
}

/** quality ∈ [0, 100]. Higher = keep in budget. */
export function computeQuestionScore(maxWeight: number, quality: number): number {
  const q = Number.isFinite(quality) ? Math.min(100, Math.max(0, quality)) : 0;
  const w = Number.isFinite(maxWeight) ? Math.max(1, maxWeight) : 1;
  return w * 100 + q;
}
