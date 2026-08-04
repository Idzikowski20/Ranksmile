/**
 * Benchmark Intelligence — structural distributions (not knowledge/claims).
 */
export type DistributionStats = {
  median: number;
  p25: number;
  p75: number;
  min: number;
  max: number;
  /** Diagnostic only — do not drive PlannerTargets primarily. */
  mean: number;
  n: number;
};

/** One competitor's measurable structure for Benchmark Intelligence. */
export type BenchmarkDocInput = {
  wordCount: number;
  h2: number;
  faq: number;
  tables: number;
  lists: number;
  images: number;
  examples: number;
  citations: number;
  sectionLens: number[];
  introLen: number;
  paragraphLens: number[];
};

export type StructuralBenchmark = {
  words: DistributionStats;
  h2: DistributionStats;
  faq: DistributionStats;
  tables: DistributionStats;
  lists: DistributionStats;
  images: DistributionStats;
  examples: DistributionStats;
  citations: DistributionStats;
  sectionLength: DistributionStats;
  introLength: DistributionStats;
  paragraphLength: DistributionStats;
  competitorCount: number;
};

/** Planner consumes these — median-first targets. */
export type PlannerTargets = {
  words: number;
  h2: number;
  faq: number;
  tables: number;
  lists: number;
  images: number;
  examples: number;
  citations: number;
  wordsSoftCeiling: number;
  h2SoftCeiling: number;
};
