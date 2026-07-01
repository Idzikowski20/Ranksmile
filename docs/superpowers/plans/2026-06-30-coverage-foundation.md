# Coverage Foundation (Sub-project A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the unified coverage foundation — `CoverageItem` (with `category` discriminator + graph-ready fields + provenance), `CoverageSnapshot` envelope, bucket-aware scoring, LLM judge, intent analyzer, AI Readability reshape, `ai_info_to_cover` JSONB column, `article_terms` activation, and editor/UI swap — so the AI gauge, bucket badges, "Information to cover", and "Intent Alignment" all read one shared snapshot.

**Architecture:** A new `lib/aiCoverage.ts` owns the `CoverageItem` model + `CoverageJudge` interface + cached `checkCoverage` + bucket-aware `computeCoverageScores` (returns `{overall, buckets}`) + the `CoverageSnapshot` wrapper. PAA from `lib/seo/keywordData.ts`, intents from `lib/introductionAnalyzer.ts`, readability from `python-sidecar/analyzers/ai_readability.py` (reshape only), entities from the `article_terms` table. All sources merge into a `CoverageSnapshot` stored in `articles.ai_info_to_cover` JSONB. `lib/coverageStore.ts` owns merge + snapshot build/parse. `lib/aiSearchScore.ts` is untouched (→ AI Tracker).

**Tech Stack:** TypeScript, Next.js (pages), Neon Postgres (JSONB), deepseek-chat (via `fetch`), Python sidecar (FastAPI), Jest.

**Spec:** `docs/superpowers/specs/2026-06-30-coverage-foundation-design.md` (v3.2 — 2nd review: `reason` + `authority` bucket + Recommendation Engine layer (C); 3rd: `computeCoverageScores` swappable helpers; 4th: snapshot version split, `CoverageItem` immutable (`readonly`), scoring operates on graded items not `CoverageResult`)
**Audit:** `docs/superpowers/specs/2026-06-30-coverage-engine-audit.md` §10.7, §10.9
**Memory:** `[[surfy-coverage-direction]]`, `[[deepseek-chat-not-reasoning-model]]`, `[[avoid-any-type]]`, `[[sidecar-repro-script-not-user]]`, `[[concurrent-sessions-hazard]]`

**Prereqs/cautions:**
- Branch `feature/gsap-motion-polish`.
- **Concurrent-session hazard:** this working dir was silently reverted once (`[[concurrent-sessions-hazard]]`). Commit each task immediately; never leave foundation work uncommitted.
- `deepseek-chat`, NOT a reasoning model — thinking block ate `max_tokens`. `temperature: 0`, `seed: 7`, `response_format: { type: 'json_object' }`.
- Reuse `lib/safeJson.ts` (`safeJsonParse`).
- Sidecar repro: hit the real API from a scratch script with the key in `python-sidecar/.env`; don't make the user restart the UI.
- 5h org token budget (`lib/aiTokenUsage.ts:7`) is 500k tokens — the new coverage + intro LLM calls add ~5k tokens per article load; verify headroom.
- `article_terms` already exists + is written (`pages/api/articles/deep-analysis.ts:457-465`); this plan only adds **reads**.
- No backfill. Column nullable; dual-read window for `article_terms` vs. `score_data.terms`.

---

## File Structure

**Create:**
- `lib/aiCoverage.ts` — `CoverageItem` + `CoverageCategory` + `CoverageProvenance` + `BucketScore` + `CoverageSnapshot` + `CoverageJudge` + `checkCoverage()` + swappable scoring helpers (`computeBucketScore` / `blendBuckets` / `earlyAnswerBonus`) + `computeCoverageScores()` orchestrator + `intentItems()` + `hashId()` + `deepseekJudge`. **The model-and-scoring core.**
- `lib/introductionAnalyzer.ts` — `analyzeIntroduction()` + `introCoverageItems()` + `deepseekIntroJudge`.
- `lib/coverageStore.ts` — `mergeCoverageItems()` + `buildSnapshot()` + `parseSnapshot()` + `parseCoverageItems()`.
- `__tests__/lib/aiCoverage.test.ts`, `__tests__/lib/introductionAnalyzer.test.ts`, `__tests__/lib/coverageStore.test.ts`, `__tests__/lib/articleTerms.test.ts`.

**Modify:**
- `lib/ensureArticlesTables.ts` (`:49` area) — add `ai_info_to_cover JSONB`.
- `lib/seo/keywordData.ts` — add `paaCoverageItems(questions)` (stable hashed ids, `category:'knowledge'`).
- `lib/articleTerms.ts` (existing `ArticleTerm` at `:27-32`) — add `readArticleTerms` + `articleTermsToCoverageItems`.
- `python-sidecar/analyzers/ai_readability.py` (`:91` return) — emit additional `coverage_items` field (`category:'quality'`). Additive only.
- `pages/api/articles/deep-analysis.ts` (`:467-492`) — build all four sources, run judge + intro + readability, build `CoverageSnapshot`, persist.
- `pages/api/articles/ai-readability.ts` (`:42`) — merge readability into snapshot on standalone re-analysis.
- `pages/articles/[id]/index.tsx` (`:614-615`, `:1971`) — parse snapshot, pass `coverageItems` + `buckets` + `aiCoverageScore`.
- `components/articles/ContentScorePanel.tsx` (`:525, 566, 583`) — `snapshot.overall` fallback; pass `coverageItems` + `buckets`.
- `components/articles/WriteOptimizePanel.tsx` — delete `buildInfoToCover` + `intentCovered`; render 4 cards + bucket badges from props.
- `lib/contentScore.ts` (`collectScoreSlots()` `:302-373`) — accept optional `coverageItems`; entity items override legacy `terms` slot.

**Untouched:** `lib/aiSearchScore.ts`, `lib/aiVisibilityStore.ts`, `components/articles/AiSearchPanel.tsx` (→ AI Tracker); `components/articles/ScoreTrio.tsx:50`; `ai_readability.py::apply_ai_readability`.

---

## Task 1: CoverageItem model + CoverageSnapshot + bucket scoring (pure)

**Files:**
- Create: `lib/aiCoverage.ts`
- Test: `__tests__/lib/aiCoverage.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/lib/aiCoverage.test.ts
import {
  computeCoverageScores, computeBucketScore, blendBuckets, earlyAnswerBonus,
  CoverageItem,
} from '../../lib/aiCoverage';

// GRADED item factory — the scorer works on graded items (covered/quality baked in), NOT CoverageResult.
const gi = (
  id: string,
  covered: boolean,
  quality: number,
  category: CoverageItem['category'] = 'knowledge',
  importance: CoverageItem['importance'] = 'recommended',
): CoverageItem => ({
  id, label: id, type: 'paa', category, importance,
  source: 'paa', covered, quality,
});

describe('computeCoverageScores', () => {
  it('no items → overall 0, 5 empty buckets (intent/knowledge/authority/quality/style)', () => {
    const { overall, buckets } = computeCoverageScores([], false);
    expect(overall).toBe(0);
    expect(buckets.map((b) => b.key)).toEqual(['intent', 'knowledge', 'authority', 'quality', 'style']);
    expect(buckets.every((b) => b.score === 0 && b.items === 0)).toBe(true);
  });
  it('all covered q5 + early → overall 100', () => {
    const items = [gi('a', true, 5, 'knowledge'), gi('b', true, 5, 'intent', 'critical')];
    expect(computeCoverageScores(items, true).overall).toBe(100);
  });
  it('all covered q5, no early → overall 85', () => {
    const items = [gi('a', true, 5, 'knowledge'), gi('b', true, 5, 'intent', 'critical')];
    expect(computeCoverageScores(items, false).overall).toBe(85);
  });
  it('quality matters: single knowledge item covered q1 → bucket score 20', () => {
    const { buckets } = computeCoverageScores([gi('a', true, 1, 'knowledge')], false);
    expect(buckets.find((b) => b.key === 'knowledge')?.score).toBe(20);
  });
  it('empty bucket contributes 0 weight (paa-only article not dragged by empty intent)', () => {
    const { overall, buckets } = computeCoverageScores([gi('a', true, 5, 'knowledge')], false);
    expect(overall).toBe(85);                 // knowledge fully covered, no early
    expect(buckets.find((b) => b.key === 'intent')?.items).toBe(0);
    expect(buckets.find((b) => b.key === 'intent')?.score).toBe(0);
  });
  it('per-bucket importance weighting: critical covered + optional uncovered → knowledge bucket 75', () => {
    const items = [gi('a', true, 5, 'knowledge', 'critical'), gi('b', false, 0, 'knowledge', 'optional')];
    // earned = 3×1 = 3 ; max = 3+1 = 4 ; 3/4 = 75
    expect(computeCoverageScores(items, false).buckets.find((b) => b.key === 'knowledge')?.score).toBe(75);
  });
});

// The swappable helpers are exported + tested in isolation so weight/algorithm changes
// can't silently break the blend (3rd-review risk). They read graded items — no verdict map (4th-review).
describe('scoring helpers (isolated)', () => {
  it('computeBucketScore: only counts items in its category; empty → max 0, score 0', () => {
    const items = [gi('a', true, 5, 'knowledge'), gi('b', true, 5, 'intent', 'critical')];
    const empty = computeBucketScore('authority', items);
    expect(empty.items).toBe(0);
    expect(empty.max).toBe(0);
    expect(empty.score).toBe(0);
    const knowledge = computeBucketScore('knowledge', items);
    expect(knowledge.items).toBe(1);
    expect(knowledge.covered).toBe(1);
    expect(knowledge.score).toBe(100);
  });

  it('blendBuckets: weights buckets by BucketScore.weight; all-empty → 0', () => {
    expect(blendBuckets([])).toBe(0);
    const buckets = computeCoverageScores([gi('a', true, 5, 'knowledge')], false).buckets;
    // knowledge fully covered, all other buckets empty (weight-0 contribution) → base 85
    expect(Math.round(blendBuckets(buckets))).toBe(85);
  });

  it('earlyAnswerBonus: 15 when flagged, 0 otherwise', () => {
    expect(earlyAnswerBonus(true)).toBe(15);
    expect(earlyAnswerBonus(false)).toBe(0);
  });
});
```

- [ ] **Step 2: Run → fail**

Run: `npx jest __tests__/lib/aiCoverage.test.ts --ci`
Expected: FAIL — `Cannot find module '../../lib/aiCoverage'`.

- [ ] **Step 3: Implement**

```ts
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
```

- [ ] **Step 4: Run → pass**

Run: `npx jest __tests__/lib/aiCoverage.test.ts --ci`
Expected: PASS (9 tests — 6 `computeCoverageScores` + 3 isolated-helper).

- [ ] **Step 5: Commit**

```bash
git add lib/aiCoverage.ts __tests__/lib/aiCoverage.test.ts
git commit -m "feat(coverage): CoverageItem + Snapshot + bucket scoring (swappable pure helpers)"
```

---

## Task 2: checkCoverage (injected judge + versioned cache) + intentItems(5) + hashId

**Files:**
- Modify: `lib/aiCoverage.ts`
- Test: append to `__tests__/lib/aiCoverage.test.ts`

- [ ] **Step 1: Write the failing test (append)**

```ts
// __tests__/lib/aiCoverage.test.ts (append)
import { checkCoverage, intentItems, hashId, CoverageJudge } from '../../lib/aiCoverage';

const paaItems: CoverageItem[] = [
  { id: 'paa-x', label: 'Q1?', type: 'paa', category: 'knowledge', importance: 'recommended', source: 'paa', covered: false, quality: 0 },
];
const judge = (run: CoverageJudge['run']): CoverageJudge => ({ version: 'test-v1', run });

describe('checkCoverage', () => {
  it('empty items → no judge call', async () => {
    const run = jest.fn();
    expect(await checkCoverage('t', [], judge(run as never))).toEqual({ items: [], answersMainQuestionEarly: false });
    expect(run).not.toHaveBeenCalled();
  });
  it('drops unknown + duplicate ids, keeps verdict fields', async () => {
    const j = judge(async () => ({ items: [
      { id: 'paa-x', covered: true, quality: 4, confidence: 0.9, missing: ['dosage'] },
      { id: 'paa-x', covered: false, quality: 0, confidence: 1 },
      { id: 'ghost', covered: true, quality: 5, confidence: 1 },
    ], answersMainQuestionEarly: true }));
    const r = await checkCoverage('body', paaItems, j);
    expect(r.items).toEqual([{ id: 'paa-x', covered: true, quality: 4, confidence: 0.9, missing: ['dosage'] }]);
    expect(r.answersMainQuestionEarly).toBe(true);
  });
  it('caches by version+ids+hash (run called once)', async () => {
    const run = jest.fn(async () => ({ items: [], answersMainQuestionEarly: false }));
    await checkCoverage('same', paaItems, judge(run));
    await checkCoverage('same', paaItems, judge(run));
    expect(run).toHaveBeenCalledTimes(1);
  });
});

describe('intentItems', () => {
  it('returns 5 fixed ids with category:intent; answer-main + answer-early are critical', () => {
    const it = intentItems();
    expect(it.map((x) => x.id)).toEqual([
      'intent-answer-main', 'intent-answer-early',
      'intent-expectations', 'intent-who', 'intent-why',
    ]);
    expect(it[0].importance).toBe('critical');
    expect(it[1].importance).toBe('critical');
    expect(it.slice(2).every((x) => x.importance === 'recommended')).toBe(true);
    expect(it.every((x) => x.type === 'intent' && x.category === 'intent' && x.source === 'llm')).toBe(true);
  });
});

describe('hashId', () => {
  it('is stable + differs by input', () => {
    expect(hashId('abc')).toBe(hashId('abc'));
    expect(hashId('abc')).not.toBe(hashId('abd'));
  });
});
```

- [ ] **Step 2: Run → fail**

Run: `npx jest __tests__/lib/aiCoverage.test.ts --ci`
Expected: FAIL — exports `checkCoverage`, `intentItems`, `hashId`, `CoverageJudge` not found.

- [ ] **Step 3: Implement (append to `lib/aiCoverage.ts`)**

```ts
// lib/aiCoverage.ts (append)
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

/** Run the injected judge; drop unknown/duplicate verdict ids; cache by version+ids+content hash. */
export async function checkCoverage(
  plainText: string,
  items: CoverageItem[],
  judge: CoverageJudge,
): Promise<CoverageResult> {
  if (!items.length) return { items: [], answersMainQuestionEarly: false };
  const key = `${judge.version}|${items.map((i) => i.id).join(',')}::${hashId(plainText)}`;
  const cached = coverageCache.get(key);
  if (cached) return cached;
  const verdict = await judge.run(plainText, items.map((i) => ({ id: i.id, label: i.label, type: i.type })));
  const known = new Set(items.map((i) => i.id));
  const seen = new Set<string>();
  const verdicts = (verdict.items || []).filter((vd) => {
    if (!known.has(vd.id) || seen.has(vd.id)) return false;
    seen.add(vd.id);
    return true;
  });
  const out: CoverageResult = { items: verdicts, answersMainQuestionEarly: !!verdict.answersMainQuestionEarly };
  coverageCache.set(key, out);
  return out;
}
```

- [ ] **Step 4: Run → pass**

Run: `npx jest __tests__/lib/aiCoverage.test.ts --ci`
Expected: PASS (11 tests total).

- [ ] **Step 5: Commit**

```bash
git add lib/aiCoverage.ts __tests__/lib/aiCoverage.test.ts
git commit -m "feat(coverage): checkCoverage (cache) + intents(5, category) + hashId"
```

---

## Task 3: deepseekJudge — default LLM judge

**Files:**
- Modify: `lib/aiCoverage.ts` (network — no unit test; integration verifies later)

- [ ] **Step 1: Verify `safeJsonParse` signature**

Run: `grep -n "export.*safeJsonParse" lib/safeJson.ts`
Expected: `export function safeJsonParse<T>(...)`. Adjust the import in Step 3 if it differs.

- [ ] **Step 2: Verify deepseek auth pattern**

Run: `grep -n "DEEPSEEK_API_KEY\|deepseek.com\|Bearer" pages/api/articles/optimize-sections.ts`
Expected: a `fetch('https://api.deepseek.com/v1/chat/completions', ...)` with `Authorization: Bearer ${process.env.DEEPSEEK_API_KEY}`. Match it in Step 3 if env name/URL differs.

- [ ] **Step 3: Implement (append to `lib/aiCoverage.ts`)**

```ts
// lib/aiCoverage.ts (append)
import { safeJsonParse } from './safeJson';

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
    });
    const data = await res.json().catch(() => ({}));
    const parsed = safeJsonParse<{ items?: CoverageVerdict[]; answersMainQuestionEarly?: boolean }>(
      data?.choices?.[0]?.message?.content ?? '', {},
    );
    return { items: parsed.items ?? [], answersMainQuestionEarly: !!parsed.answersMainQuestionEarly };
  },
};
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add lib/aiCoverage.ts
git commit -m "feat(coverage): deepseek-chat judge (quality, confidence, missing[])"
```

---

## Task 4: paaCoverageItems builder (stable hashed ids, category:knowledge)

**Files:**
- Modify: `lib/seo/keywordData.ts`
- Test: append to `__tests__/lib/aiCoverage.test.ts`

- [ ] **Step 1: Write the failing test (append)**

```ts
// __tests__/lib/aiCoverage.test.ts (append)
import { paaCoverageItems } from '../../lib/seo/keywordData';

describe('paaCoverageItems', () => {
  it('stable hashed ids regardless of order; category:knowledge', () => {
    const a = paaCoverageItems([{ question: 'What is X?' }, { question: 'How does Y work?' }]);
    const b = paaCoverageItems([{ question: 'How does Y work?' }, { question: 'What is X?' }]);
    expect(a.map((i) => i.id).sort()).toEqual(b.map((i) => i.id).sort());
    expect(a[0].type).toBe('paa');
    expect(a[0].category).toBe('knowledge');
    expect(a[0].source).toBe('paa');
    expect(a[0].importance).toBe('recommended');
  });
  it('returns [] for empty input', () => expect(paaCoverageItems([])).toEqual([]));
});
```

- [ ] **Step 2: Run → fail**

Run: `npx jest __tests__/lib/aiCoverage.test.ts -t paaCoverageItems --ci`
Expected: FAIL — export `paaCoverageItems` not found.

- [ ] **Step 3: Implement (append near PAA usage in `lib/seo/keywordData.ts`)**

```ts
// lib/seo/keywordData.ts (append)
import { CoverageItem, hashId } from '../aiCoverage';

/** Map People-Also-Ask questions to coverage items with STABLE ids (hash of question text,
 *  not array index — DataForSEO may reorder results). */
export function paaCoverageItems(questions: Array<{ question: string }>): CoverageItem[] {
  return questions.map((q) => ({
    id: `paa-${hashId(q.question)}`,
    label: q.question,
    type: 'paa' as const,
    category: 'knowledge' as const,
    importance: 'recommended' as const,
    source: 'paa' as const,
    covered: false,
    quality: 0,
  }));
}
```

- [ ] **Step 4: Run → pass**

Run: `npx jest __tests__/lib/aiCoverage.test.ts -t paaCoverageItems --ci`
Expected: PASS (2 tests).

- [ ] **Step 5: Typecheck + commit**

```bash
npx tsc --noEmit
git add lib/seo/keywordData.ts __tests__/lib/aiCoverage.test.ts
git commit -m "feat(coverage): paaCoverageItems builder (stable ids, category:knowledge)"
```

---

## Task 5: `ai_info_to_cover` JSONB column

**Files:**
- Modify: `lib/ensureArticlesTables.ts`

- [ ] **Step 1: Locate the articles migrations block**

Run: `grep -n "ALTER TABLE articles ADD COLUMN\|CREATE TABLE.*articles" lib/ensureArticlesTables.ts`
Expected: existing `ALTER TABLE articles ADD COLUMN IF NOT EXISTS ...` migrations near the `articles` table.

- [ ] **Step 2: Add the column (next to existing articles ADD COLUMN block)**

```ts
// lib/ensureArticlesTables.ts
await sql`ALTER TABLE articles ADD COLUMN IF NOT EXISTS ai_info_to_cover JSONB`;
```

- [ ] **Step 3: Typecheck + verify**

Run: `npx tsc --noEmit`
Expected: no new errors.

Trigger migration (hit any articles API in dev), then:
```bash
psql "$DATABASE_URL" -c "\d articles" | grep ai_info_to_cover
```
Expected: `ai_info_to_cover | jsonb`.

- [ ] **Step 4: Commit**

```bash
git add lib/ensureArticlesTables.ts
git commit -m "feat(coverage): ai_info_to_cover JSONB column on articles"
```

---

## Task 6: IntroductionAnalyzer

**Files:**
- Create: `lib/introductionAnalyzer.ts`
- Test: `__tests__/lib/introductionAnalyzer.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/lib/introductionAnalyzer.test.ts
import { analyzeIntroduction, introCoverageItems, IntroductionJudge, IntroVerdict } from '../../lib/introductionAnalyzer';

const judge = (run: IntroductionJudge['run']): IntroductionJudge => ({ version: 'test-intro-v1', run });

describe('analyzeIntroduction', () => {
  it('returns verdict from injected judge', async () => {
    const j = judge(async () => ({
      intentConfirmed: true, answerStartsEarly: true,
      audienceMentioned: false, goalMentioned: true, expectationsSet: true,
    }));
    const v = await analyzeIntroduction('intro text', 'react hooks', j);
    expect(v.intentConfirmed).toBe(true);
    expect(v.audienceMentioned).toBe(false);
  });
  it('falls back to safe defaults on judge failure', async () => {
    const j = judge(async () => { throw new Error('LLM down'); });
    const v = await analyzeIntroduction('intro text', 'react hooks', j);
    expect(v).toEqual({
      intentConfirmed: false, answerStartsEarly: false,
      audienceMentioned: false, goalMentioned: false, expectationsSet: false,
    });
  });
  it('skips judge call when intro text empty', async () => {
    const run = jest.fn();
    await analyzeIntroduction('', 'react hooks', judge(run as never));
    expect(run).not.toHaveBeenCalled();
  });
});

describe('introCoverageItems', () => {
  it('maps verdict onto 5 fixed intent items (category:intent)', () => {
    const verdict: IntroVerdict = {
      intentConfirmed: true, answerStartsEarly: false,
      audienceMentioned: true, goalMentioned: false, expectationsSet: true,
    };
    const items = introCoverageItems(verdict);
    expect(items.map((i) => i.id)).toEqual([
      'intent-answer-main', 'intent-answer-early',
      'intent-expectations', 'intent-who', 'intent-why',
    ]);
    expect(items[0].covered).toBe(true);     // intentConfirmed
    expect(items[0].quality).toBe(5);
    expect(items[1].covered).toBe(false);    // answerStartsEarly
    expect(items[2].covered).toBe(true);     // expectationsSet
    expect(items[3].covered).toBe(true);     // audienceMentioned
    expect(items[4].covered).toBe(false);    // goalMentioned
    expect(items.every((i) => i.category === 'intent')).toBe(true);
  });
});
```

- [ ] **Step 2: Run → fail**

Run: `npx jest __tests__/lib/introductionAnalyzer.test.ts --ci`
Expected: FAIL — `Cannot find module '../../lib/introductionAnalyzer'`.

- [ ] **Step 3: Implement**

```ts
// lib/introductionAnalyzer.ts
import { CoverageItem, intentItems } from './aiCoverage';
import { safeJsonParse } from './safeJson';

export interface IntroVerdict {
  intentConfirmed: boolean;
  answerStartsEarly: boolean;
  audienceMentioned: boolean;
  goalMentioned: boolean;
  expectationsSet: boolean;
  detectedMainQuestion?: string;
  notes?: Record<string, string>;
}

export interface IntroductionJudge {
  version: string;
  run: (introText: string, targetKeyword: string) => Promise<IntroVerdict>;
}

const SAFE_DEFAULT: IntroVerdict = {
  intentConfirmed: false, answerStartsEarly: false,
  audienceMentioned: false, goalMentioned: false, expectationsSet: false,
};

export async function analyzeIntroduction(
  introText: string, targetKeyword: string, judge: IntroductionJudge,
): Promise<IntroVerdict> {
  if (!introText.trim()) return SAFE_DEFAULT;
  try {
    return await judge.run(introText, targetKeyword);
  } catch {
    return SAFE_DEFAULT;
  }
}

/** Map the intro verdict onto the 5 fixed CoverageItem rows from intentItems(). */
export function introCoverageItems(verdict: IntroVerdict): CoverageItem[] {
  const map: Record<string, boolean> = {
    'intent-answer-main':  verdict.intentConfirmed,
    'intent-answer-early': verdict.answerStartsEarly,
    'intent-expectations': verdict.expectationsSet,
    'intent-who':          verdict.audienceMentioned,
    'intent-why':          verdict.goalMentioned,
  };
  return intentItems().map((it) => {
    const covered = !!map[it.id];
    return { ...it, covered, quality: covered ? 5 : 0 };
  });
}

const INTRO_MODEL = 'deepseek-chat';
const INTRO_TEMPERATURE = 0;
const INTRO_PROMPT_VERSION = 'v1';

export const deepseekIntroJudge: IntroductionJudge = {
  version: `${INTRO_PROMPT_VERSION}|${INTRO_MODEL}|${INTRO_TEMPERATURE}`,
  run: async (introText, targetKeyword) => {
    const system = 'You analyze the FIRST ~500 words of an SEO article. Reply ONLY with JSON.';
    const user =
      `Target keyword: "${targetKeyword}"\n\n` +
      'For the intro below, return JSON {' +
      '"intentConfirmed": bool, "answerStartsEarly": bool, ' +
      '"audienceMentioned": bool, "goalMentioned": bool, "expectationsSet": bool, ' +
      '"detectedMainQuestion": string}\n\n' +
      'Criteria:\n' +
      '- intentConfirmed: the intro names what this article delivers about the keyword\n' +
      '- answerStartsEarly: the first paragraph directly answers the main question (not background)\n' +
      '- audienceMentioned: the intro identifies who the reader is\n' +
      '- goalMentioned: the intro explains why this matters / what the reader gains\n' +
      '- expectationsSet: the intro previews the article structure or scope\n\n' +
      '=== INTRO ===\n' + introText + '\n=== END ===';
    const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: INTRO_MODEL, temperature: INTRO_TEMPERATURE, seed: 7,
        response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      }),
    });
    const data = await res.json().catch(() => ({}));
    const parsed = safeJsonParse<Partial<IntroVerdict>>(data?.choices?.[0]?.message?.content ?? '', {});
    return {
      intentConfirmed: !!parsed.intentConfirmed,
      answerStartsEarly: !!parsed.answerStartsEarly,
      audienceMentioned: !!parsed.audienceMentioned,
      goalMentioned: !!parsed.goalMentioned,
      expectationsSet: !!parsed.expectationsSet,
      detectedMainQuestion: parsed.detectedMainQuestion,
    };
  },
};
```

- [ ] **Step 4: Run → pass**

Run: `npx jest __tests__/lib/introductionAnalyzer.test.ts --ci`
Expected: PASS (4 tests).

- [ ] **Step 5: Typecheck + commit**

```bash
npx tsc --noEmit
git add lib/introductionAnalyzer.ts __tests__/lib/introductionAnalyzer.test.ts
git commit -m "feat(coverage): IntroductionAnalyzer (5 intent items, deepseek judge)"
```

---

## Task 7: AI Readability reshape — emit `coverage_items` (category:quality)

**Files:**
- Modify: `python-sidecar/analyzers/ai_readability.py`

- [ ] **Step 1: Inspect current return shape**

Run: `grep -n "return\|criteria\|score" python-sidecar/analyzers/ai_readability.py | head -40`
Expected: a function returning `{"score": int, "criteria": [...]}` near line 91; criteria definitions `(key, label, description)` near 12-23.

- [ ] **Step 2: Add the CoverageItem reshape (additive)**

Add this helper after the criteria constants:

```python
# python-sidecar/analyzers/ai_readability.py (add helper)

def _to_coverage_items(criteria_results):
    """Reshape rubric results into CoverageItem-compatible dicts (category=quality)."""
    items = []
    for c in criteria_results:
        key = c.get("key")
        if not key:
            continue
        met = bool(c.get("met"))
        suggestions = c.get("suggestions") or []
        items.append({
            "id": f"readability-{key}",
            "label": c.get("label") or key,
            "type": "readability",
            "category": "quality",
            "importance": "recommended",
            "source": "llm",
            "covered": met,
            "quality": 5 if met else 0,
            "missing": [s for s in suggestions if isinstance(s, str)],
            "needsExpansion": (not met) and bool(suggestions),
        })
    return items
```

Change the return site (~line 91) from:
```python
return {"score": score, "criteria": criteria_results}
```
to:
```python
return {
    "score": score,
    "criteria": criteria_results,
    "coverage_items": _to_coverage_items(criteria_results),
}
```

> Additive only — keep `score` + `criteria`. If key names differ, match them.

- [ ] **Step 3: Smoke test via sidecar script (memory `[[sidecar-repro-script-not-user]]`)**

```bash
SCRATCH="/c/Users/patry/AppData/Local/Temp/claude/C--Users-patry/ce5f6809-bcf2-4dd7-a317-908ad631eb9a/scratchpad"
mkdir -p "$SCRATCH"
cat > "$SCRATCH/test_readability.py" <<'EOF'
import json, sys
sys.path.insert(0, 'python-sidecar')
from analyzers.ai_readability import analyze_ai_readability
html = "<h1>React Hooks</h1><p>Hooks let you use state in functional components.</p><h2>useState</h2><p>Lorem ipsum.</p>"
r = analyze_ai_readability(html, target_keyword="react hooks")
assert {"score","criteria","coverage_items"} <= set(r), r
assert all(c["id"].startswith("readability-") and c["category"]=="quality" for c in r["coverage_items"]), r
print(json.dumps(r["coverage_items"][:2], indent=2))
EOF
cd /c/Users/patry/Desktop/serpbear && python "$SCRATCH/test_readability.py"
```
Expected: prints 2 CoverageItem dicts; assertions pass.

> Adjust the function name/signature if `analyze_ai_readability` differs. Goal: verify `coverage_items` exists alongside `criteria`.

- [ ] **Step 4: Commit**

```bash
git add python-sidecar/analyzers/ai_readability.py
git commit -m "feat(coverage): AI Readability emits coverage_items (category:quality, additive)"
```

---

## Task 8: `article_terms` read + adapter (category:knowledge)

**Files:**
- Modify: `lib/articleTerms.ts`
- Test: `__tests__/lib/articleTerms.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/lib/articleTerms.test.ts
import { articleTermsToCoverageItems, ArticleTermRow } from '../../lib/articleTerms';

const row = (over: Partial<ArticleTermRow> = {}): ArticleTermRow => ({
  term: 't', term_type: 'topic', source: 'serp',
  importance: 0.5, target_min: 2, target_max: 4, current_count: 0, ...over,
});

describe('articleTermsToCoverageItems', () => {
  it('topic/entity → type:entity, category:knowledge, importance thresholded', () => {
    const items = articleTermsToCoverageItems([
      row({ term: 'crit', importance: 0.9 }),
      row({ term: 'rec', importance: 0.5 }),
      row({ term: 'opt', importance: 0.1 }),
    ]);
    expect(items.map((i) => i.importance)).toEqual(['critical', 'recommended', 'optional']);
    expect(items.every((i) => i.type === 'entity' && i.category === 'knowledge')).toBe(true);
  });
  it('term_type:question → type:fact (still category:knowledge)', () => {
    const [item] = articleTermsToCoverageItems([row({ term: 'q', term_type: 'question' })]);
    expect(item.type).toBe('fact');
    expect(item.category).toBe('knowledge');
  });
  it('covered + quality from current_count vs target', () => {
    const [under] = articleTermsToCoverageItems([row({ current_count: 0 })]);
    expect(under.covered).toBe(false);
    expect(under.quality).toBe(0);
    const [met] = articleTermsToCoverageItems([row({ current_count: 3 })]);
    expect(met.covered).toBe(true);
    expect(met.quality).toBe(5);
    const [partial] = articleTermsToCoverageItems([row({ current_count: 1 })]);
    expect(partial.covered).toBe(false);
    expect(partial.quality).toBeGreaterThan(0);
    expect(partial.quality).toBeLessThan(5);
  });
  it('stable hashed ids regardless of order', () => {
    const a = articleTermsToCoverageItems([row({ term: 'hooks' }), row({ term: 'state' })]);
    const b = articleTermsToCoverageItems([row({ term: 'state' }), row({ term: 'hooks' })]);
    expect(a.map((i) => i.id).sort()).toEqual(b.map((i) => i.id).sort());
  });
});
```

- [ ] **Step 2: Run → fail**

Run: `npx jest __tests__/lib/articleTerms.test.ts --ci`
Expected: FAIL — `articleTermsToCoverageItems` / `ArticleTermRow` not found.

- [ ] **Step 3: Implement (extend `lib/articleTerms.ts`)**

```ts
// lib/articleTerms.ts (append)
import { CoverageItem, CoverageSource, hashId } from './aiCoverage';

/** A row from the `article_terms` DB table (lib/ensureArticlesTables.ts:106-118). */
export interface ArticleTermRow {
  term: string;
  term_type: 'keyword' | 'topic' | 'entity' | 'question';
  source: CoverageSource;
  importance: number;          // 0..1
  target_min: number;
  target_max: number;
  current_count: number;
}

function importanceBucket(n: number): CoverageItem['importance'] {
  if (n >= 0.8) return 'critical';
  if (n >= 0.4) return 'recommended';
  return 'optional';
}

function quality(currentCount: number, targetMax: number): number {
  if (targetMax <= 0) return 0;
  return Math.min(5, Math.round((currentCount / targetMax) * 5));
}

/** Map article_terms rows to CoverageItems. term_type='question' → type:'fact'; else 'entity'. */
export function articleTermsToCoverageItems(rows: ArticleTermRow[]): CoverageItem[] {
  return rows.map((r) => {
    const isFact = r.term_type === 'question';
    const covered = r.current_count >= r.target_min;
    return {
      id: `${isFact ? 'fact' : 'entity'}-${hashId(r.term)}`,
      label: r.term,
      type: isFact ? 'fact' : 'entity',
      category: 'knowledge' as const,
      importance: importanceBucket(r.importance ?? 0),
      source: r.source ?? 'serp',
      covered,
      quality: covered ? 5 : quality(r.current_count, r.target_max),
    };
  });
}

/** Fetch article_terms rows for one article. Returns [] on no rows.
 *  NOTE: match the file's existing `sql` import style — this signature assumes an injected tagged-template `sql`. */
export async function readArticleTerms(
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => Promise<{ rows: ArticleTermRow[] }>,
  articleId: number,
): Promise<ArticleTermRow[]> {
  const { rows } = await sql`
    SELECT term, term_type, source, importance, target_min, target_max, current_count
    FROM article_terms WHERE article_id = ${articleId}
  `;
  return rows;
}
```

> Verify the file's existing `sql` import; if it imports `sql` from `./neon` directly, drop the `sql` parameter and import it. Match `pages/api/articles/deep-analysis.ts:457-465`.

- [ ] **Step 4: Run → pass**

Run: `npx jest __tests__/lib/articleTerms.test.ts --ci`
Expected: PASS (4 tests).

- [ ] **Step 5: Typecheck + commit**

```bash
npx tsc --noEmit
git add lib/articleTerms.ts __tests__/lib/articleTerms.test.ts
git commit -m "feat(coverage): article_terms read + CoverageItem adapter (entity/fact, knowledge)"
```

---

## Task 9: coverageStore — merge + buildSnapshot + parseSnapshot

**Files:**
- Create: `lib/coverageStore.ts`
- Test: `__tests__/lib/coverageStore.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/lib/coverageStore.test.ts
import { mergeCoverageItems, buildSnapshot, parseSnapshot } from '../../lib/coverageStore';
import { CoverageItem, CoverageResult } from '../../lib/aiCoverage';

const item = (id: string, type: CoverageItem['type'] = 'paa', category: CoverageItem['category'] = 'knowledge'): CoverageItem =>
  ({ id, label: id, type, category, importance: 'recommended', source: 'paa', covered: false, quality: 0 });

describe('mergeCoverageItems', () => {
  it('concatenates per-source arrays, ordered', () => {
    const merged = mergeCoverageItems({
      paa: [item('paa-1')],
      intent: [item('intent-1', 'intent', 'intent')],
      readability: [item('readability-1', 'readability', 'quality')],
      entity: [item('entity-1', 'entity', 'knowledge')],
    });
    expect(merged.map((i) => i.id)).toEqual(['paa-1', 'intent-1', 'readability-1', 'entity-1']);
  });
  it('dedupes by id, last source wins', () => {
    const dup = { ...item('paa-1'), quality: 4, covered: true };
    const merged = mergeCoverageItems({ paa: [item('paa-1')], intent: [dup], readability: [], entity: [] });
    expect(merged).toHaveLength(1);
    expect(merged[0].quality).toBe(4);
  });
});

const META = { judgeVersion: 'v1|deepseek-chat|0', promptVersion: 'v1', model: 'deepseek-chat', createdAt: '2026-06-30T00:00:00Z' };

describe('buildSnapshot', () => {
  it('grades items, derives early flag, wraps with split version fields', () => {
    const items = [item('paa-1')];
    const result: CoverageResult = { items: [{ id: 'paa-1', covered: true, quality: 5, confidence: 1 }], answersMainQuestionEarly: false };
    const snap = buildSnapshot(items, result, META);
    expect(snap.schemaVersion).toBe(1);
    expect(snap.judgeVersion).toBe('v1|deepseek-chat|0');
    expect(snap.promptVersion).toBe('v1');
    expect(snap.model).toBe('deepseek-chat');
    expect(snap.items[0].covered).toBe(true);      // graded from the verdict
    expect(snap.items[0].quality).toBe(5);
    expect(snap.answersMainQuestionEarly).toBe(false);
    expect(snap.buckets).toHaveLength(5);          // intent/knowledge/authority/quality/style
    expect(snap.overall).toBe(85);
  });
});

describe('parseSnapshot', () => {
  it('returns null for non-snapshot input', () => {
    expect(parseSnapshot(null)).toBeNull();
    expect(parseSnapshot([])).toBeNull();                    // legacy array, not a snapshot
    expect(parseSnapshot({ schemaVersion: 99 })).toBeNull(); // unknown schema
    expect(parseSnapshot({ version: 1, items: [], buckets: [] })).toBeNull(); // v2 field name → rejected
  });
  it('round-trips a valid snapshot', () => {
    const items = [item('paa-1')];
    const result: CoverageResult = { items: [{ id: 'paa-1', covered: true, quality: 5, confidence: 1 }], answersMainQuestionEarly: false };
    const snap = buildSnapshot(items, result, META);
    expect(parseSnapshot(JSON.parse(JSON.stringify(snap)))).toEqual(snap);
  });
});
```

- [ ] **Step 2: Run → fail**

Run: `npx jest __tests__/lib/coverageStore.test.ts --ci`
Expected: FAIL — `Cannot find module '../../lib/coverageStore'`.

- [ ] **Step 3: Implement**

```ts
// lib/coverageStore.ts
import { CoverageItem, CoverageResult, CoverageSnapshot, computeCoverageScores } from './aiCoverage';

export interface CoverageSources {
  paa: CoverageItem[];
  intent: CoverageItem[];
  readability: CoverageItem[];
  entity: CoverageItem[];
}

/** Merge per-source CoverageItem arrays into a single ordered list, deduped by id (last source wins). */
export function mergeCoverageItems(src: CoverageSources): CoverageItem[] {
  const all = [...src.paa, ...src.intent, ...src.readability, ...src.entity];
  const byId = new Map<string, CoverageItem>();
  for (const it of all) byId.set(it.id, it);
  return Array.from(byId.values());
}

/** THE ONLY place CoverageResult (the judge artifact) is consumed (4th-review layer boundary).
 *  Applies verdicts onto items → GRADED immutable items, derives the early flag, scores off the
 *  graded items, and wraps everything into a versioned snapshot. Nothing downstream sees CoverageResult. */
export function buildSnapshot(
  items: CoverageItem[],
  result: CoverageResult,
  meta: { judgeVersion: string; promptVersion: string; model: string; createdAt: string },
): CoverageSnapshot {
  const byId = new Map(result.items.map((vd) => [vd.id, vd]));
  const graded: CoverageItem[] = items.map((it) => {
    const vd = byId.get(it.id);
    if (!vd) return it;
    return {
      ...it,
      covered: !!vd.covered,
      quality: vd.quality ?? it.quality,
      confidence: vd.confidence,
      needsExpansion: vd.needsExpansion,
      missing: vd.missing,
      reason: vd.reason,
      sectionId: vd.sectionId,
      provenance: { judgedBy: meta.model, judgedAt: meta.createdAt, promptVersion: meta.promptVersion },
    };
  });
  const early = result.answersMainQuestionEarly;
  const { overall, buckets } = computeCoverageScores(graded, early);   // graded items + boolean; no CoverageResult
  return {
    schemaVersion: 1,
    judgeVersion: meta.judgeVersion,
    promptVersion: meta.promptVersion,
    model: meta.model,
    createdAt: meta.createdAt,
    items: graded,
    buckets,
    answersMainQuestionEarly: early,
    overall,
  };
}

/** Parse a stored ai_info_to_cover value into a CoverageSnapshot, or null if absent/legacy/unknown schema. */
export function parseSnapshot(raw: unknown): CoverageSnapshot | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const snap = raw as Partial<CoverageSnapshot>;
  if (snap.schemaVersion !== 1 || !Array.isArray(snap.items) || !Array.isArray(snap.buckets)) return null;
  return snap as CoverageSnapshot;
}

/** Read just the items off a snapshot (or [] when absent). Convenience for UI that doesn't need buckets. */
export function parseCoverageItems(raw: unknown): CoverageItem[] {
  const snap = parseSnapshot(raw);
  return snap ? snap.items : [];
}
```

- [ ] **Step 4: Run → pass**

Run: `npx jest __tests__/lib/coverageStore.test.ts --ci`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/coverageStore.ts __tests__/lib/coverageStore.test.ts
git commit -m "feat(coverage): coverageStore — merge + buildSnapshot + parseSnapshot"
```

---

## Task 10: Wire deep-analysis to compute + persist the snapshot

**Files:**
- Modify: `pages/api/articles/deep-analysis.ts` (`:467-492`)

- [ ] **Step 1: Locate the AI-visibility persist block**

Run: `grep -n "getAiSearchInfo\|ai_visibility_summary\|persistAiVisibilityRun\|target_keyword" pages/api/articles/deep-analysis.ts`
Expected: lines ~467-492 where `AiVisibilitySummary` is built/persisted; confirm `plainText`, `paa.questions`, `articleId`, `content` (HTML), `article.target_keyword`, and the `sql` helper are in scope.

- [ ] **Step 2: Add imports**

```ts
// pages/api/articles/deep-analysis.ts (top)
import { paaCoverageItems } from '../../../lib/seo/keywordData';
import { checkCoverage, deepseekJudge, CoverageItem } from '../../../lib/aiCoverage';
import { analyzeIntroduction, introCoverageItems, deepseekIntroJudge } from '../../../lib/introductionAnalyzer';
import { readArticleTerms, articleTermsToCoverageItems } from '../../../lib/articleTerms';
import { mergeCoverageItems, buildSnapshot } from '../../../lib/coverageStore';
import { splitSections } from '../../../lib/articleSections';
```

- [ ] **Step 3: After the AI-visibility persist block, build + store the snapshot**

```ts
// pages/api/articles/deep-analysis.ts (after ~line 492)
try {
  const intro = splitSections(content)[0];
  const introPlain = intro ? intro.html.replace(/<[^>]+>/g, '').trim() : '';

  const paaItems       = paaCoverageItems(paa?.questions ?? []);
  const intentResult   = await analyzeIntroduction(introPlain, article.target_keyword ?? '', deepseekIntroJudge);
  const baseIntent     = introCoverageItems(intentResult);

  const termRows       = await readArticleTerms(sql, articleId);
  const entityItems    = articleTermsToCoverageItems(termRows);

  const readabilityItems: CoverageItem[] = []; // standalone ai-readability run (Task 11) fills these

  const items = mergeCoverageItems({
    paa: paaItems, intent: baseIntent, readability: readabilityItems, entity: entityItems,
  });

  // Judge only paa + future fact/definition (intent already graded by intro analyzer; entity/readability deterministic).
  const judgeable = items.filter((i) => i.type === 'paa' || i.type === 'fact' || i.type === 'definition' || i.type === 'comparison' || i.type === 'example');
  const coverageResult = await checkCoverage(plainText, judgeable, deepseekJudge);

  // Fold the intent verdict's early-answer flag into the result the snapshot scores against.
  coverageResult.answersMainQuestionEarly = intentResult.answerStartsEarly;
  // Intent + entity + readability are already "graded" on their items; include them as pre-covered verdicts
  // so buildSnapshot's bucket math sees them.
  for (const it of [...baseIntent, ...entityItems]) {
    coverageResult.items.push({ id: it.id, covered: it.covered, quality: it.quality, confidence: 1 });
  }

  // judge.version is 'promptVersion|model|temperature' → split for the snapshot's separate version fields.
  const [promptVersion, model] = deepseekJudge.version.split('|');
  const snapshot = buildSnapshot(items, coverageResult, {
    judgeVersion: deepseekJudge.version,
    promptVersion,
    model,
    createdAt: new Date().toISOString(),
  });

  await sql`UPDATE articles SET ai_info_to_cover = ${JSON.stringify(snapshot)} WHERE id = ${articleId}`;
  responseExtras.ai_info_to_cover = snapshot;
  responseExtras.ai_coverage_score = snapshot.overall;
} catch (err) {
  console.warn('[coverage] deep-analysis snapshot compute failed', err);
  // never block deep-analysis on coverage errors; the gauge falls back to computeAiSearchScore
}
```

> `responseExtras` is whatever object the handler returns; splice the two fields into the actual response literal if there's no accumulator. `sql` is the file's existing helper; if `readArticleTerms` imports its own `sql`, drop the argument.

- [ ] **Step 4: Typecheck + smoke test**

Run: `npx tsc --noEmit`
Expected: no new errors.

Deep-analyze a test article in dev, then:
```bash
psql "$DATABASE_URL" -c "SELECT id, ai_info_to_cover->>'overall' AS overall, jsonb_array_length(ai_info_to_cover->'items') AS items FROM articles WHERE ai_info_to_cover IS NOT NULL LIMIT 5;"
```
Expected: a row with a numeric `overall` and non-zero `items`.

- [ ] **Step 5: Commit**

```bash
git add pages/api/articles/deep-analysis.ts
git commit -m "feat(coverage): deep-analysis builds + persists CoverageSnapshot"
```

---

## Task 11: ai-readability endpoint merges readability items into the snapshot

**Files:**
- Modify: `pages/api/articles/ai-readability.ts` (`:42`)

- [ ] **Step 1: Locate the handler**

Run: `grep -n "ai_readability_json\|coverage_items\|sql\`" pages/api/articles/ai-readability.ts`
Expected: a handler calling the sidecar `/ai-readability`, writing `articles.ai_readability_json`.

- [ ] **Step 2: After the existing persist, merge readability items into the snapshot**

```ts
// pages/api/articles/ai-readability.ts (top)
import { CoverageItem } from '../../../lib/aiCoverage';
import { mergeCoverageItems, parseSnapshot, buildSnapshot } from '../../../lib/coverageStore';
```

After the `ai_readability_json` update:

```ts
try {
  const readabilityItems: CoverageItem[] = Array.isArray(sidecarResult?.coverage_items)
    ? (sidecarResult.coverage_items as CoverageItem[])
    : [];
  const { rows } = await sql`SELECT ai_info_to_cover FROM articles WHERE id = ${articleId}`;
  const prev = parseSnapshot(rows[0]?.ai_info_to_cover);
  const keep = prev ? prev.items.filter((i) => i.type !== 'readability') : [];

  const items = mergeCoverageItems({
    paa: keep.filter((i) => i.type === 'paa'),
    intent: keep.filter((i) => i.category === 'intent'),
    readability: readabilityItems,
    entity: keep.filter((i) => i.type === 'entity' || i.type === 'fact'),
  });

  // Re-grade snapshot using the prior verdicts already baked into kept items + the fresh readability items.
  // This endpoint does NOT re-run the coverage judge, so preserve prev's version metadata.
  const verdictItems = items.map((i) => ({ id: i.id, covered: i.covered, quality: i.quality, confidence: i.confidence ?? 1 }));
  const snapshot = buildSnapshot(items, {
    items: verdictItems,
    answersMainQuestionEarly: prev?.answersMainQuestionEarly ?? false,
  }, {
    judgeVersion: prev?.judgeVersion ?? 'v1|deepseek-chat|0',
    promptVersion: prev?.promptVersion ?? 'v1',
    model: prev?.model ?? 'deepseek-chat',
    createdAt: new Date().toISOString(),
  });

  await sql`UPDATE articles SET ai_info_to_cover = ${JSON.stringify(snapshot)} WHERE id = ${articleId}`;
} catch (err) {
  console.warn('[coverage] ai-readability snapshot merge failed', err);
}
```

> Match the handler's `sql` / `articleId` / `sidecarResult` variable names. Additive — do not touch the `ai_readability_json` write.

- [ ] **Step 3: Typecheck + smoke test**

Run: `npx tsc --noEmit`
Expected: no new errors.

Trigger "Analyze Content" on PrePublishPanel, then verify the snapshot's items now include 10 `readability-*` ids:
```bash
psql "$DATABASE_URL" -c "SELECT jsonb_array_length(ai_info_to_cover->'items') FROM articles WHERE id = <THE_ID>;"
```

- [ ] **Step 4: Commit**

```bash
git add pages/api/articles/ai-readability.ts
git commit -m "feat(coverage): ai-readability merges readability items into snapshot"
```

---

## Task 12: Editor hydration + ContentScorePanel fallback swap

**Files:**
- Modify: `pages/articles/[id]/index.tsx` (`:614-615`, `:1971`)
- Modify: `components/articles/ContentScorePanel.tsx` (`:525, 566, 583`)

- [ ] **Step 1: Hydrate snapshot in the editor**

```ts
// pages/articles/[id]/index.tsx (imports)
import { CoverageItem, BucketScore } from '../../lib/aiCoverage';
import { parseSnapshot } from '../../lib/coverageStore';
```

```ts
// state (near aiVisibilitySummary state)
const [coverageItems, setCoverageItems] = useState<CoverageItem[]>([]);
const [coverageBuckets, setCoverageBuckets] = useState<BucketScore[]>([]);
const [aiCoverageScore, setAiCoverageScore] = useState<number | null>(null);
```

```ts
// hydration (near :614)
const snap = parseSnapshot(art.ai_info_to_cover);
// spread: snapshot arrays are `readonly` (immutable model) → widen to the mutable state type.
setCoverageItems(snap ? [...snap.items] : []);
setCoverageBuckets(snap ? [...snap.buckets] : []);
setAiCoverageScore(snap?.overall ?? null);
```

```tsx
{/* panel site ~:1971 */}
<ContentScorePanel
  // ...existing props...
  aiVisibilitySummary={aiVisibilitySummary}
  coverageItems={coverageItems}
  coverageBuckets={coverageBuckets}
  aiCoverageScore={aiCoverageScore}
/>
```

- [ ] **Step 2: ContentScorePanel — props + fallback at 3 sites**

```ts
// components/articles/ContentScorePanel.tsx (imports + Props)
import { CoverageItem, BucketScore } from '../../lib/aiCoverage';

type Props = {
  // ...existing...
  coverageItems?: CoverageItem[];
  coverageBuckets?: BucketScore[];
  aiCoverageScore?: number | null;
};
```

Line **583** (editor gauge):
```ts
const aiScore = aiCoverageScore ?? (hasAi ? computeAiSearchScore(aiVisibilitySummary) : 0);
```

Line **525** (WriteOptimizePanel prop):
```tsx
<WriteOptimizePanel
  // ...existing...
  ai={aiCoverageScore ?? (hasAi ? computeAiSearchScore(aiVisibilitySummary) : 0)}
  coverageItems={coverageItems}
  coverageBuckets={coverageBuckets}
/>
```

Line **566** (PrePublishPanel prop):
```tsx
<PrePublishPanel
  // ...existing...
  aiScore={aiCoverageScore ?? (hasAi ? computeAiSearchScore(aiVisibilitySummary) : 0)}
/>
```

- [ ] **Step 3: Typecheck + build + UI smoke**

Run: `npx tsc --noEmit && npm run build`
Expected: exit 0.

Open a deep-analyzed article: gauge shows snapshot `overall`; an older article (NULL column) still shows legacy citation score (fallback).

- [ ] **Step 4: Commit**

```bash
git add pages/articles/[id]/index.tsx components/articles/ContentScorePanel.tsx
git commit -m "feat(coverage): editor hydrates snapshot, gauge falls back to legacy score"
```

---

## Task 13: WriteOptimizePanel — 4 cards + bucket badges from props

**Files:**
- Modify: `components/articles/WriteOptimizePanel.tsx` (delete `buildInfoToCover` `:46-56`, `intentCovered` `:272`, replace cards `:473-481`)

- [ ] **Step 1: Update Props**

```ts
// components/articles/WriteOptimizePanel.tsx
import { CoverageItem, BucketScore } from '../../lib/aiCoverage';

type Props = {
  // ...existing...
  coverageItems?: CoverageItem[];
  coverageBuckets?: BucketScore[];
};
```

- [ ] **Step 2: Delete `buildInfoToCover` (`:46-56`) and `intentCovered` (`:272`)**

Remove the entire `buildInfoToCover` function and the `intentCovered` derived line.

- [ ] **Step 3: Replace the intent + info-to-cover cards (`:473-481`) with data-driven render**

Preserve surrounding inline-style containers (project convention: inline `style={{}}`, not Tailwind — memory `[[content-score-gauge-look]]`). Replace inner items:

```tsx
const items = coverageItems ?? [];
const intentRows      = items.filter((i) => i.category === 'intent');
const knowledgeRows   = items.filter((i) => i.type === 'paa' || i.type === 'fact');
const readabilityRows = items.filter((i) => i.type === 'readability');

{/* Bucket badges */}
<div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
  {(coverageBuckets ?? []).filter((b) => b.items > 0).map((b) => (
    <span key={b.key} style={{ /* pill style from design.md */ borderRadius: 9999, padding: '2px 10px', fontSize: 12 }}>
      {b.label} {b.score}%
    </span>
  ))}
</div>

{/* Upfront Intent Alignment */}
<section>
  <header>Upfront Intent Alignment</header>
  {intentRows.map((i) => (
    <div key={i.id} style={{ /* row style */ }} data-covered={i.covered}>
      <span data-covered={i.covered} /* status dot */ />
      <span>{i.label}</span>
      {i.missing?.length ? <ul>{i.missing.map((m, k) => <li key={k}>{m}</li>)}</ul> : null}
    </div>
  ))}
</section>

{/* Information to cover (PAA + facts) */}
<section>
  <header>Information to cover</header>
  {knowledgeRows.map((i) => (
    <div key={i.id} style={{ /* row style */ }} data-covered={i.covered}>
      <span data-covered={i.covered} /* status dot */ />
      <span>{i.label}</span>
      {!i.covered && i.missing?.length ? <ul>{i.missing.map((m, k) => <li key={k}>{m}</li>)}</ul> : null}
    </div>
  ))}
</section>
```

> Replace the placeholder `style={{}}` comments with the actual inline-style patterns already used in this component (status-dot color from `#1AB25E` covered / `#D4D4D8` uncovered per design tokens). The readability rows live in PrePublishPanel, not here — `readabilityRows` is computed for completeness but not rendered in this card set unless the design calls for it.

- [ ] **Step 4: Remove orphaned imports/types (`[[avoid-any-type]]` — delete, don't `any`-cast)**

Delete `AiCitation`/`InfoItem`/`buildInfoToCover` if unreferenced.

- [ ] **Step 5: Typecheck + build + UI smoke**

Run: `npx tsc --noEmit && npm run build`
Expected: exit 0.

Manual: intent card shows 5 rows with per-item state; info-to-cover lists PAA with `missing` hints; bucket badges show populated buckets.

- [ ] **Step 6: Commit**

```bash
git add components/articles/WriteOptimizePanel.tsx
git commit -m "feat(coverage): WriteOptimizePanel renders coverageItems + bucket badges"
```

---

## Task 14: `collectScoreSlots` accepts `coverageItems` (dual-read window)

**Files:**
- Modify: `lib/contentScore.ts` (`collectScoreSlots()` `:302-373`)
- Test: `__tests__/lib/contentScore-coverage-slot.test.ts`

- [ ] **Step 1: Inspect the current terms slot**

Run: `grep -n "'terms'\|termsCoverage\|_termsCoverage" lib/contentScore.ts | head -20`
Expected: a slot push (~`:319-340`, weight 25) consuming `scoreData.terms`.

- [ ] **Step 2: Write the failing test**

```ts
// __tests__/lib/contentScore-coverage-slot.test.ts
import { collectScoreSlots } from '../../lib/contentScore';
import type { CoverageItem } from '../../lib/aiCoverage';

const entity = (label: string, covered: boolean): CoverageItem => ({
  id: `entity-${label}`, label, type: 'entity', category: 'knowledge',
  importance: 'recommended', source: 'serp', covered, quality: covered ? 5 : 0,
});

describe('collectScoreSlots — coverageItems dual-read', () => {
  it('prefers coverageItems entity rows over legacy scoreData.terms', () => {
    const html = '<h1>X</h1><p>hooks state effect</p>';
    const scoreData = { terms: [], words: 200, headings: 3, paragraphs: 3, paa_questions: [] } as any;
    const withItems = collectScoreSlots(html, scoreData, 'X', [entity('hooks', true), entity('state', false)]);
    const withoutItems = collectScoreSlots(html, scoreData, 'X', undefined);
    const slot = (s: ReturnType<typeof collectScoreSlots>) => s.find((x) => x.key === 'terms');
    expect((slot(withItems)?.earned ?? 0)).toBeGreaterThan(slot(withoutItems)?.earned ?? 0);
  });
  it('falls back to legacy scoreData.terms when no coverageItems (zero regression)', () => {
    const html = '<h1>X</h1><p>hooks hooks hooks</p>';
    const scoreData = { terms: [{ term: 'hooks', target_count: 2, current_count: 3 }], words: 200, headings: 3, paragraphs: 3, paa_questions: [] } as any;
    const t = collectScoreSlots(html, scoreData, 'X', undefined).find((s) => s.key === 'terms');
    expect(t?.earned).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 3: Run → fail**

Run: `npx jest __tests__/lib/contentScore-coverage-slot.test.ts --ci`
Expected: FAIL — `collectScoreSlots` doesn't accept a 4th arg.

- [ ] **Step 4: Implement — extend signature + gate terms slot**

```ts
// lib/contentScore.ts
import type { CoverageItem } from './aiCoverage';

export function collectScoreSlots(
  html: string,
  scoreData: ScoreData,
  keyword: string,
  coverageItems?: CoverageItem[],   // NEW
): ScoreSlot[] {
  // ...existing slot pushes...

  // ===== terms slot — prefer coverageItems entity rows when present =====
  const entityItems = (coverageItems ?? []).filter((i) => i.type === 'entity');
  if (entityItems.length > 0) {
    const covered = entityItems.filter((i) => i.covered).length;
    const earned = Math.round((covered / entityItems.length) * 25);
    slots.push({ key: 'terms', max: 25, earned, hint: `${covered}/${entityItems.length} terms covered` });
  } else {
    // legacy fallback — existing scoreData.terms block moves here UNCHANGED
    // ...existing terms slot code...
  }

  // ...rest unchanged...
}
```

Thread the optional param through `computeContentScore` + `computeContentScoreBreakdown`:
```ts
export function computeContentScore(html: string, scoreData: ScoreData, keyword: string, coverageItems?: CoverageItem[]): number { /* pass to collectScoreSlots */ }
export function computeContentScoreBreakdown(html: string, scoreData: ScoreData, keyword: string, coverageItems?: CoverageItem[]): ScoreBreakdown { /* pass to collectScoreSlots */ }
```

- [ ] **Step 5: Run → pass + no regression**

Run: `npx jest __tests__/lib/contentScore-coverage-slot.test.ts --ci`
Expected: PASS (2 tests).

Run: `npx jest __tests__/lib/contentScore --ci`
Expected: all existing scoring tests still PASS.

- [ ] **Step 6: Thread `coverageItems` into live call sites**

- `components/articles/ContentScorePanel.tsx:340`: `computeContentScore(html, scoreData, keyword, coverageItems)`
- `components/articles/ContentScorePanel.tsx:507`: `computeContentScoreBreakdown(html, scoreData, keyword, coverageItems)`
- `pages/articles/[id]/index.tsx:730, 787, 1146`: pass `coverageItems` where in scope.
- `pages/api/articles/deep-analysis.ts:406` + `pages/api/articles/import.ts:334`: pass when in scope (else leave undefined → legacy path).

- [ ] **Step 7: Typecheck + build + commit**

Run: `npx tsc --noEmit && npm run build`
Expected: exit 0.

```bash
git add lib/contentScore.ts components/articles/ContentScorePanel.tsx \
        pages/articles/[id]/index.tsx pages/api/articles/deep-analysis.ts \
        pages/api/articles/import.ts __tests__/lib/contentScore-coverage-slot.test.ts
git commit -m "feat(coverage): collectScoreSlots reads article_terms via coverageItems (dual-read)"
```

---

## Final verification

- [ ] All Jest suites green: `npx jest --ci`
- [ ] `npx tsc --noEmit` — clean.
- [ ] `npm run build` — exit 0.
- [ ] `graphify update .` — refreshes the graph.
- [ ] **Manual end-to-end:**
  - Deep-analyze → snapshot populated (PAA + intent + entity; readability after standalone "Analyze Content").
  - Editor AI gauge shows `snapshot.overall`; older articles (NULL) fall back to legacy.
  - Bucket badges render (Intent / Knowledge / Quality).
  - WriteOptimizePanel: 5 intent rows with real state; PAA rows with `missing` hints.
  - PrePublishPanel "Analyze Content" still works; readability items appear in snapshot.
  - SEO score matches between `article_terms`-driven (fresh) and `scoreData.terms`-driven (older) paths within rounding.
- [ ] Token-budget check during a coverage run (memory `[[deepseek-chat-not-reasoning-model]]` — verify neither LLM call empty-outputs; 5h budget headroom OK).

## Self-review (spec coverage)

- A1 — CoverageItem (category + provenance + graph-ready + confidence + **reason**) + Snapshot + bucket scoring → Tasks 1, 2, 3. ✓
- A1 — **`authority` 5th bucket** declared (empty in A; sources in E) → Task 1 (CoverageCategory + BUCKET maps). ✓
- A1 — **`reason` captured on the judge call** (feeds the future Recommendation Engine, no re-judge) → Task 1 (verdict/item field) + Task 3 (prompt) + Task 10 (buildSnapshot copies it). ✓
- A1 — **`computeCoverageScores` decomposed into swappable pure helpers** (`computeBucketScore`/`blendBuckets`/`earlyAnswerBonus`), each unit-tested in isolation (3rd-review risk on the load-bearing scorer) → Task 1. ✓
- A1 — **scoring operates on graded `CoverageItem[]` + a boolean, NOT `CoverageResult`** (4th-review layer boundary); `CoverageResult` confined to `buildSnapshot` → Task 1 (helper signatures) + Task 9 (builder). ✓
- A1 — **`CoverageItem` immutable** (`readonly` fields + arrays) → Task 1. ✓
- A1 — **snapshot version split** (`schemaVersion` / `judgeVersion` / `promptVersion` / `model`) + promoted `answersMainQuestionEarly`; `parseSnapshot` gates on `schemaVersion` → Task 1 (interface) + Task 9 (build/parse) + Tasks 10/11 (meta shape). ✓
- A1 — PAA builder (category:knowledge) → Task 4. ✓
- A1 — `ai_info_to_cover` column → Task 5. ✓
- A3 — IntroductionAnalyzer + 5 intent items (category:intent) → Tasks 2 + 6. ✓
- A2 — AI Readability reshape (category:quality) → Task 7 + merge Task 11. ✓
- A5 — `article_terms` activation → Task 8 + Task 14 (dual-read). ✓
- Snapshot build/parse + merge → Task 9. ✓
- deep-analysis wiring → Task 10. ✓
- A4 — editor hydration + gauge swap (snapshot.overall) → Task 12. ✓
- A4 — WriteOptimizePanel (4 cards + bucket badges) → Task 13. ✓
- Bucket scoring surfaced in UI → Tasks 12 + 13. ✓
- Fallback (NULL snapshot → legacy citation score) → Task 12. ✓
- `lib/aiSearchScore.ts`, `aiVisibilityStore.ts`, `AiSearchPanel.tsx`, `ScoreTrio.tsx:50` untouched → no task modifies them. ✓
- Out of scope (B context, **C Recommendation Engine**, D planner + Outline-from-Plan, E graph + extended sources incl. authority sources, AiReadabilityPanel carve-out, AI Tracker rebrand) → no tasks. ✓
- Push-backs (no CoverageItem→Guideline rename; no `instruction` on item; `optimization` metadata deferred to D; `derived/` folder for projectedLift/priority deferred to C) → no A-level task; recorded in spec "Review response". ✓
