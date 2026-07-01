// lib/aiCoverage.ts
export type CoverageType =
  | 'paa' | 'fact' | 'definition' | 'comparison' | 'example'
  | 'entity' | 'process' | 'statistic' | 'expectation' | 'warning'
  | 'readability' | 'structure'
  | 'intent';

// 'authority' declared now (empty in A) to lock the bucket taxonomy + score denominator; sources land in E.
export type CoverageCategory = 'knowledge' | 'authority' | 'quality' | 'style' | 'intent';
export type Importance = 'critical' | 'recommended' | 'optional';
export type CoverageSource = 'serp' | 'competitors' | 'paa' | 'llm' | 'manual';

export interface CoverageProvenance {
  judgedBy?: string;
  judgedAt?: string;
  promptVersion?: string;
}

// IMMUTABLE — never mutate in place (no `item.covered = true`); produce a new object via spread.
export interface CoverageItem {
  readonly id: string;
  readonly label: string;
  readonly type: CoverageType;
  readonly category: CoverageCategory;
  readonly importance: Importance;
  readonly source: CoverageSource;
  readonly covered: boolean;
  readonly quality: number;            // 0..5
  readonly confidence?: number;        // 0..1
  readonly needsExpansion?: boolean;
  readonly missing?: readonly string[];
  readonly reason?: string;            // WHY uncovered/shallow — captured on the judge call, feeds the Recommendation Engine
  readonly sectionId?: string;
  readonly parentId?: string | null;   // graph-ready (flat in A)
  readonly relatedIds?: readonly string[];  // graph-ready (empty in A)
  readonly depth?: number;             // graph-ready (0 in A)
  readonly provenance?: CoverageProvenance;
}

export interface CoverageVerdict {
  id: string;
  covered: boolean;
  quality: number;            // 0..5
  confidence: number;         // 0..1
  needsExpansion?: boolean;
  missing?: string[];
  reason?: string;            // WHY — same LLM call; feeds the Recommendation Engine (no re-judge)
  sectionId?: string;
}

export interface CoverageResult {
  items: CoverageVerdict[];
  answersMainQuestionEarly: boolean;
}

export interface BucketScore {
  key: CoverageCategory;
  label: string;
  weight: number;
  items: number;
  covered: number;
  earned: number;
  max: number;
  score: number;              // 0..100
}

export interface CoverageSnapshot {
  readonly schemaVersion: 1;               // envelope shape; parseSnapshot gates on this. A prompt tweak does NOT bump it.
  readonly judgeVersion: string;           // 'promptVersion|model|temperature' — cache key + staleness detector
  readonly promptVersion: string;          // just the prompt tag, e.g. 'v1'
  readonly model: string;                  // e.g. 'deepseek-chat'
  readonly createdAt: string;
  readonly items: readonly CoverageItem[]; // ALREADY GRADED
  readonly buckets: readonly BucketScore[];
  readonly answersMainQuestionEarly: boolean;  // promoted onto the domain model (scorer needs no CoverageResult)
  readonly overall: number;                // 0..100
}

const CATEGORIES: CoverageCategory[] = ['intent', 'knowledge', 'authority', 'quality', 'style'];
const BUCKET_WEIGHT: Record<CoverageCategory, number> = { intent: 3, knowledge: 2, authority: 2, quality: 2, style: 1 };
const BUCKET_LABEL: Record<CoverageCategory, string> = {
  intent: 'Intent', knowledge: 'Knowledge', authority: 'Authority', quality: 'Quality', style: 'Style',
};
const IMPORTANCE_WEIGHT: Record<Importance, number> = { critical: 3, recommended: 2, optional: 1 };

const clampQuality = (q: number): number => Math.min(Math.max(q, 0), 5);

/** One bucket's importance×quality/5 over covered items. Reads GRADED items (item.covered/item.quality) —
 *  it does NOT know about CoverageVerdict/CoverageResult/the judge (4th-review: LLM artifact stays in the builder). */
export function computeBucketScore(
  category: CoverageCategory,
  items: readonly CoverageItem[],
): BucketScore {
  const inBucket = items.filter((it) => it.category === category);
  let earned = 0;
  let max = 0;
  let covered = 0;
  for (const it of inBucket) {
    const w = IMPORTANCE_WEIGHT[it.importance];
    max += w;
    if (it.covered) {
      covered += 1;
      earned += w * (clampQuality(it.quality) / 5);
    }
  }
  return {
    key: category,
    label: BUCKET_LABEL[category],
    weight: BUCKET_WEIGHT[category],
    items: inBucket.length,
    covered,
    earned,
    max,
    score: max > 0 ? Math.round((earned / max) * 100) : 0,
  };
}

/** Bucket-weighted blend, capped to 85. Empty buckets contribute 0 (max 0). Pure. */
export function blendBuckets(buckets: readonly BucketScore[]): number {
  let weightedEarned = 0;
  let weightedMax = 0;
  for (const b of buckets) {
    weightedEarned += b.weight * b.earned;
    weightedMax += b.weight * b.max;
  }
  return weightedMax > 0 ? (weightedEarned / weightedMax) * 85 : 0;
}

/** The +15 early-answer bonus. Pure — takes a plain boolean, not CoverageResult. */
export function earlyAnswerBonus(answersMainQuestionEarly: boolean): number {
  return answersMainQuestionEarly ? 15 : 0;
}

/** Orchestrator — composes the three swappable helpers over GRADED items + a plain boolean. No CoverageResult.
 *  Weights live in BUCKET_WEIGHT / IMPORTANCE_WEIGHT module constants → tuning is a one-constant edit. */
export function computeCoverageScores(
  items: readonly CoverageItem[],
  answersMainQuestionEarly: boolean,
): { overall: number; buckets: BucketScore[] } {
  const buckets = CATEGORIES.map((key) => computeBucketScore(key, items));
  const overall = Math.round(blendBuckets(buckets) + earlyAnswerBonus(answersMainQuestionEarly));
  return { overall, buckets };
}
