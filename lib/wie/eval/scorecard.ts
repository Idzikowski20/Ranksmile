/**
 * Writing Intelligence Scorecard — single 0–100 composite.
 */
export type ScorecardInputs = {
  /** 0–100 from Editorial Judge (category * 10) or heuristic fallback */
  readerExperience: number;
  narrative: number;
  expertVoice: number;
  informationGain: number;
  /** Pipeline SEO 0–100 */
  seo: number;
  /** Coverage % or 0–100 quality */
  coverage: number;
  /** EEAT composite 0–100 */
  eeat: number;
  /** Pattern usage signal 0–100 (e.g. has decisions * effectiveness) */
  patternUsage: number;
};

export type ScorecardResult = {
  writingIntelligence: number;
  weights: Record<keyof ScorecardInputs, number>;
  parts: ScorecardInputs;
};

export const SCORECARD_WEIGHTS: Record<keyof ScorecardInputs, number> = {
  readerExperience: 0.2,
  narrative: 0.15,
  expertVoice: 0.15,
  informationGain: 0.15,
  seo: 0.1,
  coverage: 0.1,
  eeat: 0.1,
  patternUsage: 0.05,
};

function clamp100(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

/** Map Judge 0–10 → 0–100. */
export function scale10to100(score10: number): number {
  return clamp100(score10 * 10);
}

export function computeWritingIntelligence(raw: ScorecardInputs): ScorecardResult {
  const parts: ScorecardInputs = {
    readerExperience: clamp100(raw.readerExperience),
    narrative: clamp100(raw.narrative),
    expertVoice: clamp100(raw.expertVoice),
    informationGain: clamp100(raw.informationGain),
    seo: clamp100(raw.seo),
    coverage: clamp100(raw.coverage),
    eeat: clamp100(raw.eeat),
    patternUsage: clamp100(raw.patternUsage),
  };

  let sum = 0;
  for (const k of Object.keys(SCORECARD_WEIGHTS) as (keyof ScorecardInputs)[]) {
    sum += parts[k] * SCORECARD_WEIGHTS[k];
  }

  return {
    writingIntelligence: Math.round(sum * 10) / 10,
    weights: { ...SCORECARD_WEIGHTS },
    parts,
  };
}

/** Pattern usage: activated pattern ids OR explainability decisions that imply Writer should apply them. */
export function patternUsageScore(opts: {
  patternIdsUsed?: string[];
  /** Explainability / policy decisions count (opening, examples, voice…) */
  decisionCount?: number;
  avgEffectiveness?: number;
  /** Share of policy rules actually observed in HTML (0–1) */
  compliancePassRate?: number;
}): number {
  const n = Math.max(opts.patternIdsUsed?.length ?? 0, opts.decisionCount ?? 0);
  if (n <= 0) return 20;
  const base = Math.min(100, 40 + n * 12);
  let score = base;
  if (opts.avgEffectiveness != null) {
    score = 0.5 * base + 0.5 * (opts.avgEffectiveness * 100);
  }
  // If we know compliance: blend so unused decisions don't inflate the score
  if (opts.compliancePassRate != null) {
    score = 0.4 * score + 0.6 * (opts.compliancePassRate * 100);
  }
  return clamp100(score);
}

/** Coverage items → 0–100 from covered ratio. */
export function coverageScoreFromSnapshot(opts: {
  total?: number;
  covered?: number;
}): number {
  const total = opts.total ?? 0;
  const covered = opts.covered ?? 0;
  if (total <= 0) return 40;
  return clamp100((covered / total) * 100);
}
