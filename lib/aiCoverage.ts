// lib/aiCoverage.ts
import { safeJsonParse } from './safeJson';

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

const clampQuality = (q: number): number => {
  const n = Number(q);
  return Number.isFinite(n) ? Math.min(Math.max(n, 0), 5) : 0;
};

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

export interface CoverageJudge {
  version: string;
  run: (
    plainText: string,
    items: Array<Pick<CoverageItem, 'id' | 'label' | 'type'>>,
  ) => Promise<CoverageResult>;
}

const INTENT_ITEMS: ReadonlyArray<Omit<CoverageItem, 'covered' | 'quality'>> = [
  { id: 'intent-answer-main',  label: 'Answer the main question',             type: 'intent', category: 'intent', importance: 'critical',    source: 'llm' },
  { id: 'intent-answer-early', label: 'Answer the main question early',       type: 'intent', category: 'intent', importance: 'critical',    source: 'llm' },
  { id: 'intent-expectations', label: 'Set expectations for the content',     type: 'intent', category: 'intent', importance: 'recommended', source: 'llm' },
  { id: 'intent-who',          label: "Identify who it's for",                type: 'intent', category: 'intent', importance: 'recommended', source: 'llm' },
  { id: 'intent-why',          label: 'Explain why it matters to the reader', type: 'intent', category: 'intent', importance: 'recommended', source: 'llm' },
];

/** The 5 fixed search intents, fresh each call. */
export function intentItems(): CoverageItem[] {
  return INTENT_ITEMS.map((i) => ({ ...i, covered: false, quality: 0 }));
}

/** djb2 — cheap deterministic hash for stable ids + the coverage cache key. */
export function hashId(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i += 1) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

const coverageCache = new Map<string, CoverageResult>();

/** Independent copy so caller mutation of a returned result can't leak into the cache (or a prior caller's copy). */
function cloneResult(r: CoverageResult): CoverageResult {
  return { items: r.items.map((v) => ({ ...v })), answersMainQuestionEarly: r.answersMainQuestionEarly };
}

/** Run the injected judge; drop unknown/duplicate verdict ids; cache by version+ids+content hash. */
export async function checkCoverage(
  plainText: string,
  items: readonly CoverageItem[],
  judge: CoverageJudge,
): Promise<CoverageResult> {
  if (!items.length) return { items: [], answersMainQuestionEarly: false };
  const key = `${judge.version}|${items.map((i) => i.id).join(' ')}::${hashId(plainText)}`; //   delimiter can't appear in an id → no cross-set cache collision
  const cached = coverageCache.get(key);
  if (cached) return cloneResult(cached);
  const verdict = await judge.run(plainText, items.map((i) => ({ id: i.id, label: i.label, type: i.type })));
  const known = new Set(items.map((i) => i.id));
  const seen = new Set<string>();
  const rawItems = Array.isArray(verdict.items) ? verdict.items : [];
  const verdicts = rawItems.filter((vd) => {
    if (!known.has(vd.id) || seen.has(vd.id)) return false;
    seen.add(vd.id);
    return true;
  });
  const out: CoverageResult = { items: verdicts, answersMainQuestionEarly: !!verdict.answersMainQuestionEarly };
  if (coverageCache.size >= 500) coverageCache.delete(coverageCache.keys().next().value);
  coverageCache.set(key, cloneResult(out));
  return out;
}

const COVERAGE_MODEL = 'deepseek-chat';
const COVERAGE_TEMPERATURE = 0;
const COVERAGE_PROMPT_VERSION = 'v1';

/** Default judge: one deepseek-chat call. Grades quality + confidence + lists what's still missing. */
export const deepseekJudge: CoverageJudge = {
  version: `${COVERAGE_PROMPT_VERSION}|${COVERAGE_MODEL}|${COVERAGE_TEMPERATURE}`,
  run: async (plainText, items) => {
    const list = items.map((i) => `- ${i.id} [${i.type}]: ${i.label}`).join('\n');
    const system = 'You are an SEO topic-coverage auditor. Judge ONLY from the article. Reply ONLY with JSON.';
    const user =
      `Knowledge items to cover:\n${list}\n\n` +
      'For each id return: covered(bool), quality(0-5: 5=thorough explanation, 1=bare mention), ' +
      'confidence(0-1: your confidence in this verdict), needsExpansion(bool: covered but too shallow), ' +
      'missing(string[] of specific facts/sub-points still absent), ' +
      'reason(short string: WHY uncovered or shallow — e.g. "answer hidden mid-section", "fact too vague", ' +
      '"no statistics", "too generic"), ' +
      'sectionId(the id/heading covering it, if covered). Also answersMainQuestionEarly(bool): ' +
      'does the FIRST paragraph directly answer the main question?\n' +
      'JSON: {"items":[{"id","covered","quality","confidence","needsExpansion","missing":[],"reason","sectionId"}],' +
      '"answersMainQuestionEarly"}.\n\n=== ARTICLE ===\n' + plainText + '\n=== END ===';
    const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: COVERAGE_MODEL,
        temperature: COVERAGE_TEMPERATURE,
        seed: 7,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`deepseek coverage judge failed: ${res.status}`);
    const data = await res.json().catch(() => ({}));
    const parsed = safeJsonParse<{ items?: CoverageVerdict[]; answersMainQuestionEarly?: boolean }>(
      data?.choices?.[0]?.message?.content ?? '', {},
    );
    return { items: Array.isArray(parsed.items) ? parsed.items : [], answersMainQuestionEarly: !!parsed.answersMainQuestionEarly };
  },
};
