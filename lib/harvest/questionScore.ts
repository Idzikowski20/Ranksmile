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

/** Cross-engine multiplier: more unique engines → higher score (Ranksmile-like). */
export function crossEngineMultiplier(engineCoverage: number): number {
  if (engineCoverage <= 1) return 1;
  if (engineCoverage === 2) return 1.35;
  if (engineCoverage === 3) return 1.7;
  return 2.1;
}

/**
 * Question score ≈ sourceWeight × frequency × quality × crossEngine.
 * quality ∈ [0, 100]. Higher = keep in budget.
 */
export function computeQuestionScore(
  maxWeight: number,
  quality: number,
  opts?: { frequency?: number; engineCoverage?: number },
): number {
  const q = Number.isFinite(quality) ? Math.min(100, Math.max(0, quality)) : 0;
  const w = Number.isFinite(maxWeight) ? Math.max(1, maxWeight) : 1;
  const freq = Math.max(1, opts?.frequency ?? 1);
  const cross = crossEngineMultiplier(opts?.engineCoverage ?? 1);
  return (w * 100 + q) * freq * cross;
}
