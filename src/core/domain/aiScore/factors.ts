/**
 * Typed AI score, mirroring the audited AioScore contract: a value plus the factors
 * that produced it, each carrying the sentence that earned it. Weights live here,
 * not inside the formula, so they can be tuned without touching the scorers.
 */
export type FactorName =
  | 'FACTS_COVERAGE'
  | 'INTRODUCTION_COVERED_TOPICS'
  | 'INTRODUCTION_TARGET_AUDIENCE'
  | 'INTRODUCTION_EARLY_QUERY_ANSWER'
  | 'INTRODUCTION_TOPIC_RELEVANCE';

export type AioScoreStatus = 'SCHEDULED' | 'EXECUTING' | 'READY' | 'ERROR';

export type ScoreFactor = {
  name: FactorName;
  found: boolean;
  /** 0..1 */
  score: number;
  /** The sentence that satisfied the factor. Absent when found === false. */
  textSpan?: string;
  /** Percentage form, for factors the UI shows as a number. */
  value?: number;
};

export const DEFAULT_WEIGHTS: Record<FactorName, number> = {
  FACTS_COVERAGE: 4,
  INTRODUCTION_COVERED_TOPICS: 1,
  INTRODUCTION_TARGET_AUDIENCE: 1,
  INTRODUCTION_EARLY_QUERY_ANSWER: 2,
  INTRODUCTION_TOPIC_RELEVANCE: 1,
};

export function factsCoverageFactor(covered: number, total: number): ScoreFactor {
  const ratio = total > 0 ? covered / total : 0;
  return {
    name: 'FACTS_COVERAGE',
    found: total > 0 && covered > 0,
    score: ratio,
    value: Math.round(ratio * 100),
  };
}

/**
 * Weighted over the FULL factor set, not just the factors computed so far — the
 * assessment publishes factors one at a time, and the score has to climb as evidence
 * lands (20 → 40 → 45 → 60 → 70 → 90), never start high off a single lucky factor.
 */
export function aioScore(
  factors: ScoreFactor[],
  weights: Partial<Record<FactorName, number>> = {},
): { value: number; factors: ScoreFactor[] } {
  const merged = { ...DEFAULT_WEIGHTS, ...weights };
  const totalWeight = Object.values(merged).reduce((sum, weight) => sum + weight, 0);
  if (!totalWeight) return { value: 0, factors };
  const weighted = factors.reduce(
    (sum, factor) => sum + factor.score * (merged[factor.name] ?? 1),
    0,
  );
  return { value: Math.round((weighted / totalWeight) * 100), factors };
}
