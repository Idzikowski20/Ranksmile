/**
 * Signed AO score deltas + ScoreGatePolicy (v4.1).
 * AoScores.content === overallScore (SEO×0.55+AI×0.45 from scoreArticleHtml).
 * Score unavailable ≠ unchanged; flat ≠ automatically meaningful.
 */

export type ScoreAvailability = 'available' | 'unavailable' | 'stale' | 'error';

export type ScoreDirection = 'up' | 'down' | 'unchanged' | 'unknown';

/** seo / ai / content(=overall blend). */
export type AoScores = {
  seo: number;
  /** Overall Content Score (SEO×0.55 + AI×0.45) — same metric for Candidate + Final. */
  content: number;
  ai: number;
};

export type AoScoreDelta = {
  before: number | null;
  after: number | null;
  delta: number | null;
  direction: ScoreDirection;
  availability: ScoreAvailability;
};

export type AoScoreDeltaSet = {
  seo: AoScoreDelta;
  content: AoScoreDelta;
  ai: AoScoreDelta;
};

export type ScoreGateMode = 'strict_non_regression' | 'aggressive' | 'balanced' | 'weighted';

export type ScoreGateConfig = {
  mode: ScoreGateMode;
  /** Noise floor for strict mode only. Default 2. */
  minMeaningfulDelta: number;
};

/** Metric-aware policy: overall never drops; SEO/AI have drop tolerances. */
export type ScoreGatePolicy = {
  mode: ScoreGateMode;
  /** 0 = overall must not decrease (not "flat is meaningful"). */
  overallMinDelta: number;
  seoDropTolerance: number;
  aiDropTolerance: number;
  /** Kept 0 — overall path uses overallMinDelta. */
  contentDropTolerance: number;
};

export const DEFAULT_SCORE_GATE_CONFIG: ScoreGateConfig = {
  mode: 'strict_non_regression',
  minMeaningfulDelta: 2,
};

export const STRICT_SCORE_GATE_POLICY: ScoreGatePolicy = {
  mode: 'strict_non_regression',
  overallMinDelta: 0,
  seoDropTolerance: 0,
  aiDropTolerance: 0,
  contentDropTolerance: 0,
};

/** Enrichment: SEO/AI −2 allowance (safety, not spend target). */
export const ENRICHMENT_SCORE_GATE_POLICY: ScoreGatePolicy = {
  mode: 'aggressive',
  overallMinDelta: 0,
  seoDropTolerance: 2,
  aiDropTolerance: 2,
  contentDropTolerance: 0,
};

/** Deep: SEO/AI −3 allowance. */
export const DEEP_SCORE_GATE_POLICY: ScoreGatePolicy = {
  mode: 'aggressive',
  overallMinDelta: 0,
  seoDropTolerance: 3,
  aiDropTolerance: 3,
  contentDropTolerance: 0,
};

/** Epsilon for "flat" / stagnation (rounded overall). */
export const OVERALL_FLAT_EPSILON = 0;

export function makeScoreDelta(
  before: number | null,
  after: number | null,
  availability: ScoreAvailability = 'available',
): AoScoreDelta {
  if (availability !== 'available' || before == null || after == null) {
    return {
      before,
      after,
      delta: null,
      direction: 'unknown',
      availability,
    };
  }
  const delta = Math.round(after) - Math.round(before);
  const direction: ScoreDirection =
    delta > 0 ? 'up' : delta < 0 ? 'down' : 'unchanged';
  return { before, after, delta, direction, availability: 'available' };
}

export function makeScoreDeltaSet(
  before: AoScores,
  after: AoScores,
  aiAvailability: ScoreAvailability = 'available',
): AoScoreDeltaSet {
  return {
    seo: makeScoreDelta(before.seo, after.seo, 'available'),
    content: makeScoreDelta(before.content, after.content, 'available'),
    ai: makeScoreDelta(before.ai, after.ai, aiAvailability),
  };
}

export function isMeaningfulRegression(
  before: number,
  after: number,
  minMeaningfulDelta: number = DEFAULT_SCORE_GATE_CONFIG.minMeaningfulDelta,
): boolean {
  return Math.round(before) - Math.round(after) >= minMeaningfulDelta;
}

export function overallDelta(before: AoScores, after: AoScores): number {
  return Math.round(after.content) - Math.round(before.content);
}

export function isOverallFlat(before: AoScores, after: AoScores, epsilon = OVERALL_FLAT_EPSILON): boolean {
  return Math.abs(overallDelta(before, after)) <= epsilon;
}

export function isOverallUp(before: AoScores, after: AoScores): boolean {
  return overallDelta(before, after) > 0;
}

export function isOverallDown(before: AoScores, after: AoScores): boolean {
  return overallDelta(before, after) < 0;
}

export function metricDropExceedsTolerance(
  before: number,
  after: number,
  tolerance: number,
): boolean {
  return Math.round(before) - Math.round(after) > tolerance;
}

/**
 * Strict gate (v4 goldens): meaningful regression on any metric → reject.
 * AI unavailable/error → inconclusive.
 */
export function strictScoreGateRejectReason(
  before: AoScores,
  after: AoScores,
  opts: {
    minMeaningfulDelta?: number;
    aiAvailability?: ScoreAvailability;
  } = {},
): 'SEO_REGRESSION' | 'CONTENT_SCORE_REGRESSION' | 'AI_SEARCH_REGRESSION' | 'SCORE_INCONCLUSIVE' | null {
  const min = opts.minMeaningfulDelta ?? DEFAULT_SCORE_GATE_CONFIG.minMeaningfulDelta;
  const aiAvail = opts.aiAvailability ?? 'available';

  if (isMeaningfulRegression(before.seo, after.seo, min)) return 'SEO_REGRESSION';
  if (isMeaningfulRegression(before.content, after.content, min)) return 'CONTENT_SCORE_REGRESSION';

  if (aiAvail === 'error' || aiAvail === 'unavailable') return 'SCORE_INCONCLUSIVE';
  if (aiAvail === 'available' && isMeaningfulRegression(before.ai, after.ai, min)) {
    return 'AI_SEARCH_REGRESSION';
  }
  return null;
}

export type CandidateGateDecision =
  | { decision: 'accept'; reason: string }
  | { decision: 'reject_regression'; reason: string }
  | { decision: 'reject_metric_tolerance'; reason: string }
  | { decision: 'reject_non_meaningful'; reason: string }
  | { decision: 'reject_unverified_objective'; reason: string }
  | { decision: 'score_inconclusive'; reason: string };

/**
 * Candidate TEMP vs WORKING (or Final final vs BASELINE when used for final).
 * Flat overall requires verifiedObjective=true (deterministic), never LLM claim.
 */
export function evaluateCandidateGateDecision(
  before: AoScores,
  after: AoScores,
  opts: {
    policy: ScoreGatePolicy;
    aiAvailability?: ScoreAvailability;
    /** Deterministic high-value objective verified after edit. */
    verifiedObjective?: boolean;
  },
): CandidateGateDecision {
  const aiAvail = opts.aiAvailability ?? 'available';
  const policy = opts.policy;

  if (aiAvail === 'error' || aiAvail === 'unavailable') {
    return { decision: 'score_inconclusive', reason: 'AI score unavailable' };
  }

  if (policy.mode === 'strict_non_regression') {
    const reason = strictScoreGateRejectReason(before, after, {
      minMeaningfulDelta: DEFAULT_SCORE_GATE_CONFIG.minMeaningfulDelta,
      aiAvailability: aiAvail,
    });
    if (!reason) return { decision: 'accept', reason: 'strict_ok' };
    if (reason === 'SCORE_INCONCLUSIVE') {
      return { decision: 'score_inconclusive', reason };
    }
    if (reason === 'CONTENT_SCORE_REGRESSION') {
      return { decision: 'reject_regression', reason };
    }
    return { decision: 'reject_metric_tolerance', reason };
  }

  // Aggressive (enrichment / deep): overall never down; metric tolerances; flat needs verified objective
  if (isOverallDown(before, after)) {
    return { decision: 'reject_regression', reason: 'overall_down' };
  }
  if (metricDropExceedsTolerance(before.seo, after.seo, policy.seoDropTolerance)) {
    return { decision: 'reject_metric_tolerance', reason: 'seo_drop' };
  }
  if (metricDropExceedsTolerance(before.ai, after.ai, policy.aiDropTolerance)) {
    return { decision: 'reject_metric_tolerance', reason: 'ai_drop' };
  }
  if (isOverallUp(before, after)) {
    return { decision: 'accept', reason: 'overall_up' };
  }
  // Flat overall
  if (opts.verifiedObjective) {
    return { decision: 'accept', reason: 'verified_objective' };
  }
  return { decision: 'reject_non_meaningful', reason: 'flat_unverified' };
}

/** Final Gate: overall >= baseline AND SEO/AI within tol (AND). Never overall regression. */
export function evaluateFinalGateDecision(
  baseline: AoScores,
  final: AoScores,
  opts: {
    policy: ScoreGatePolicy;
    aiAvailability?: ScoreAvailability;
  },
): CandidateGateDecision {
  const aiAvail = opts.aiAvailability ?? 'available';
  if (aiAvail === 'error' || aiAvail === 'unavailable') {
    return { decision: 'score_inconclusive', reason: 'AI score unavailable' };
  }

  if (opts.policy.mode === 'strict_non_regression') {
    const reason = strictScoreGateRejectReason(baseline, final, {
      minMeaningfulDelta: DEFAULT_SCORE_GATE_CONFIG.minMeaningfulDelta,
      aiAvailability: aiAvail,
    });
    if (!reason) return { decision: 'accept', reason: 'strict_final_ok' };
    if (reason === 'SCORE_INCONCLUSIVE') {
      return { decision: 'score_inconclusive', reason };
    }
    if (reason === 'CONTENT_SCORE_REGRESSION') {
      return { decision: 'reject_regression', reason };
    }
    return { decision: 'reject_metric_tolerance', reason };
  }

  if (Math.round(final.content) < Math.round(baseline.content)) {
    return { decision: 'reject_regression', reason: 'final_overall_down' };
  }
  if (metricDropExceedsTolerance(baseline.seo, final.seo, opts.policy.seoDropTolerance)) {
    return { decision: 'reject_metric_tolerance', reason: 'final_seo_drop' };
  }
  if (metricDropExceedsTolerance(baseline.ai, final.ai, opts.policy.aiDropTolerance)) {
    return { decision: 'reject_metric_tolerance', reason: 'final_ai_drop' };
  }
  return { decision: 'accept', reason: 'final_ok' };
}

export function isPromisingSeoContent(working: AoScores, temp: AoScores): boolean {
  return (
    Math.round(temp.seo) >= Math.round(working.seo)
    && Math.round(temp.content) >= Math.round(working.content)
  );
}

export function hasSeoContentRegression(
  working: AoScores,
  temp: AoScores,
  minMeaningfulDelta: number = DEFAULT_SCORE_GATE_CONFIG.minMeaningfulDelta,
): boolean {
  return (
    isMeaningfulRegression(working.seo, temp.seo, minMeaningfulDelta)
    || isMeaningfulRegression(working.content, temp.content, minMeaningfulDelta)
  );
}
