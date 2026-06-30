# AI Search Coverage Model (Sub-project #1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the editor's AI Search Score measure topic coverage — how much of the article's `CoverageItem[]` (PAA + intents now; Facts/Definitions/… later) is covered, graded by an LLM judge for quality (not mere mention) — replacing the citation-based score in the editor gauge.

**Architecture:** A new module `lib/aiCoverage.ts` holds the `CoverageItem` knowledge-graph model, a `checkCoverage(plainText, items, judge)` that calls an **injected** judge `{version, run}` (default = deepseek-chat) and caches by `judge.version | item ids | content hash`, and a pure importance×quality `computeCoverageScore`. PAA comes from `lib/seo/keywordData.ts`; intents are fixed. Coverage is stored on the article (`ai_info_to_cover` JSON) and computed event-driven. Citation `lib/aiSearchScore.ts` is untouched (→ AI Tracker).

**Tech Stack:** TypeScript, Next.js (pages), Neon Postgres, deepseek-chat (via fetch, like `pages/api/articles/optimize-sections.ts`), Jest.

**Spec:** `docs/superpowers/specs/2026-06-30-ai-search-coverage-model-design.md`

**Prereqs/cautions:** Branch `feature/gsap-motion-polish`; concurrent session edits Auto-Optimize files — one writer. Tests: `npx jest <path> --ci`. `deepseek-chat`, NOT a reasoning model (memory: thinking block eats max_tokens). Reuse `lib/safeJson.ts`. The verdict's `missing[]`/`needsExpansion` feed #2 — keep them in the stored items even though #1 doesn't consume them.

---

## File Structure
- `lib/aiCoverage.ts` — **Create.** Model types, `intentItems()`, `hashId()`, `checkCoverage()`, `computeCoverageScore()`, `deepseekJudge`.
- `__tests__/lib/aiCoverage.test.ts` — **Create.**
- `lib/seo/keywordData.ts` — **Modify.** `paaCoverageItems(questions)` → `CoverageItem[]` (hashed ids).
- `lib/ensureArticlesTables.ts` — **Modify.** `ai_info_to_cover` JSONB column.
- `pages/api/articles/deep-analysis.ts` — **Modify.** Build items, judge, persist, return score.
- `pages/articles/[id]/index.tsx` + `components/articles/ContentScorePanel.tsx` — **Modify.** Editor AI gauge ← coverage score.

---

## Task 1: Model types + importance×quality score

**Files:** Create `lib/aiCoverage.ts`; Test `__tests__/lib/aiCoverage.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/lib/aiCoverage.test.ts
import { computeCoverageScore, CoverageItem, CoverageResult } from '../../lib/aiCoverage';

const item = (id: string, importance: CoverageItem['importance'] = 'recommended'): CoverageItem =>
  ({ id, label: id, type: 'paa', importance, covered: false, quality: 0 });
const v = (id: string, covered: boolean, quality: number) => ({ id, covered, quality, confidence: 1 });
const result = (items: CoverageResult['items'], early = false): CoverageResult =>
  ({ items, answersMainQuestionEarly: early });

describe('computeCoverageScore', () => {
  it('0 with no items', () => expect(computeCoverageScore([], result([]))).toBe(0));
  it('all covered q5 + early = 100', () =>
    expect(computeCoverageScore([item('a'), item('b')], result([v('a', true, 5), v('b', true, 5)], true))).toBe(100));
  it('all covered q5, no early = 85', () =>
    expect(computeCoverageScore([item('a'), item('b')], result([v('a', true, 5), v('b', true, 5)]))).toBe(85));
  it('quality matters: covered q1 earns 1/5 → 17', () =>
    expect(computeCoverageScore([item('a')], result([v('a', true, 1)]))).toBe(17));
  it('importance matters: critical covered, optional uncovered → 64', () =>
    expect(computeCoverageScore([item('a', 'critical'), item('b', 'optional')], result([v('a', true, 5)]))).toBe(64));
});
```

- [ ] **Step 2: Run → fail** — `npx jest __tests__/lib/aiCoverage.test.ts --ci` → `Cannot find module`.

- [ ] **Step 3: Implement**

```ts
// lib/aiCoverage.ts
export type CoverageType =
  | 'paa' | 'intent' | 'fact' | 'definition' | 'comparison'
  | 'example' | 'warning' | 'entity' | 'process' | 'statistic' | 'expectation';
export type Importance = 'critical' | 'recommended' | 'optional';

export interface CoverageItem {
  id: string;
  label: string;
  type: CoverageType;
  importance: Importance;
  covered: boolean;
  quality: number;          // 0..5
  needsExpansion?: boolean;
  missing?: string[];
  sectionId?: string;
}

export interface CoverageVerdict {
  id: string;
  covered: boolean;
  quality: number;          // 0..5
  confidence: number;       // 0..1
  needsExpansion?: boolean;
  missing?: string[];
  sectionId?: string;
}
export interface CoverageResult { items: CoverageVerdict[]; answersMainQuestionEarly: boolean; }

const WEIGHT: Record<Importance, number> = { critical: 3, recommended: 2, optional: 1 };

/** AI Search Score: Σ(weight × quality/5) over covered items, normalized to 85, + 15 for early answer. */
export function computeCoverageScore(items: CoverageItem[], result: CoverageResult): number {
  const totalW = items.reduce((s, it) => s + WEIGHT[it.importance], 0) || 1;
  const byId = new Map(result.items.map((vd) => [vd.id, vd]));
  const earned = items.reduce((s, it) => {
    const vd = byId.get(it.id);
    if (!vd || !vd.covered) return s;
    const q = Math.min(Math.max(vd.quality, 0), 5) / 5;
    return s + WEIGHT[it.importance] * q;
  }, 0);
  const early = result.answersMainQuestionEarly ? 15 : 0;
  return Math.round((earned / totalW) * 85 + early);
}
```

- [ ] **Step 4: Run → pass** — `npx jest __tests__/lib/aiCoverage.test.ts --ci` → 5 pass.

- [ ] **Step 5: Commit**

```bash
git add lib/aiCoverage.ts __tests__/lib/aiCoverage.test.ts
git commit -m "feat(ai-coverage): CoverageItem model + importance×quality score (pure)"
```

## Task 2: checkCoverage (injected judge + versioned cache) + intentItems + hashId

**Files:** Modify `lib/aiCoverage.ts`; append test.

- [ ] **Step 1: Write the failing test** (append)

```ts
import { checkCoverage, intentItems, hashId, CoverageItem, CoverageJudge } from '../../lib/aiCoverage';

const items: CoverageItem[] = [
  { id: 'paa-x', label: 'Q1?', type: 'paa', importance: 'recommended', covered: false, quality: 0 },
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
      { id: 'paa-x', covered: false, quality: 0, confidence: 1 },   // dup
      { id: 'ghost', covered: true, quality: 5, confidence: 1 },    // unknown
    ], answersMainQuestionEarly: true }));
    const r = await checkCoverage('body', items, j);
    expect(r.items).toEqual([{ id: 'paa-x', covered: true, quality: 4, confidence: 0.9, missing: ['dosage'] }]);
    expect(r.answersMainQuestionEarly).toBe(true);
  });
  it('caches by version+ids+hash (run called once)', async () => {
    const run = jest.fn(async () => ({ items: [], answersMainQuestionEarly: false }));
    await checkCoverage('same', items, judge(run));
    await checkCoverage('same', items, judge(run));
    expect(run).toHaveBeenCalledTimes(1);
  });
  it('intentItems() → 4 fixed ids, answer-main is critical', () => {
    const it = intentItems();
    expect(it.map((x) => x.id)).toEqual(['intent-answer-main', 'intent-expectations', 'intent-who', 'intent-why']);
    expect(it[0].importance).toBe('critical');
  });
  it('hashId is stable + differs by input', () => {
    expect(hashId('abc')).toBe(hashId('abc'));
    expect(hashId('abc')).not.toBe(hashId('abd'));
  });
});
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Implement** (append to `lib/aiCoverage.ts`)

```ts
export interface CoverageJudge {
  version: string; // promptVersion|model|temperature — part of the cache key
  run: (plainText: string, items: Array<Pick<CoverageItem, 'id' | 'label' | 'type'>>) => Promise<CoverageResult>;
}

const INTENT_ITEMS: ReadonlyArray<Omit<CoverageItem, 'covered' | 'quality'>> = [
  { id: 'intent-answer-main', label: 'Answer the main question', type: 'intent', importance: 'critical' },
  { id: 'intent-expectations', label: 'Set expectations for the content', type: 'intent', importance: 'recommended' },
  { id: 'intent-who', label: "Identify who it's for", type: 'intent', importance: 'recommended' },
  { id: 'intent-why', label: 'Explain why it matters to the reader', type: 'intent', importance: 'recommended' },
];

/** The 4 fixed search intents, fresh each call. */
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
export async function checkCoverage(plainText: string, items: CoverageItem[], judge: CoverageJudge): Promise<CoverageResult> {
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

- [ ] **Step 4: Run → pass** (10 tests total). **Step 5: Commit**

```bash
git add lib/aiCoverage.ts __tests__/lib/aiCoverage.test.ts
git commit -m "feat(ai-coverage): checkCoverage (injected judge + versioned cache), intents, hashId"
```

## Task 3: deepseekJudge (default LLM, quality + missing + needsExpansion)

**Files:** Modify `lib/aiCoverage.ts`. (No unit test — network. Mirror `optimize-sections.ts` auth.)

- [ ] **Step 1: Add the judge** (append)

```ts
import { safeJsonParse } from './safeJson';

const MODEL = 'deepseek-chat';
const TEMPERATURE = 0;
const PROMPT_VERSION = 'v1';

/** Default judge: one deepseek-chat call. Grades quality + lists what's still missing (feeds #2). */
export const deepseekJudge: CoverageJudge = {
  version: `${PROMPT_VERSION}|${MODEL}|${TEMPERATURE}`,
  run: async (plainText, items) => {
    const list = items.map((i) => `- ${i.id} [${i.type}]: ${i.label}`).join('\n');
    const system = 'You are an SEO topic-coverage auditor. Judge ONLY from the article. Reply ONLY with JSON.';
    const user = `Knowledge items to cover:\n${list}\n\n`
      + 'For each id return: covered(bool), quality(0-5: 5=thorough explanation, 1=bare mention), '
      + 'confidence(0-1), needsExpansion(bool: covered but too shallow), '
      + 'missing(string[] of specific facts/sub-points still absent), '
      + 'sectionId(the id/heading covering it, if covered). Also answersMainQuestionEarly(bool): '
      + 'does the FIRST paragraph directly answer the main question?\n'
      + 'JSON: {"items":[{"id","covered","quality","confidence","needsExpansion","missing":[],"sectionId"}],'
      + '"answersMainQuestionEarly"}.\n\n=== ARTICLE ===\n' + plainText + '\n=== END ===';
    const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}` },
      body: JSON.stringify({
        model: MODEL, temperature: TEMPERATURE, seed: 7,
        response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      }),
    });
    const data = await res.json().catch(() => ({}));
    const parsed = safeJsonParse<{ items?: CoverageVerdict[]; answersMainQuestionEarly?: boolean }>(
      data?.choices?.[0]?.message?.content ?? '', {});
    return { items: parsed.items ?? [], answersMainQuestionEarly: !!parsed.answersMainQuestionEarly };
  },
};
```

> Verify `process.env.DEEPSEEK_API_KEY` + the auth header match `pages/api/articles/optimize-sections.ts:113-120`; if that file uses a different env name or `seed` isn't accepted, match it / drop `seed`. Check `lib/safeJson.ts` for the exact `safeJsonParse` signature.

- [ ] **Step 2: Typecheck** — `npx tsc --noEmit` → no new errors. **Step 3: Commit**

```bash
git add lib/aiCoverage.ts
git commit -m "feat(ai-coverage): deepseek-chat judge (quality, needsExpansion, missing[])"
```

## Task 4: PAA → CoverageItem builder (stable hashed ids)

**Files:** Modify `lib/seo/keywordData.ts`

- [ ] **Step 1: Add the export** (near the PAA usage)

```ts
import { CoverageItem, hashId } from '../aiCoverage';

/** Map People-Also-Ask questions to coverage items with STABLE ids (hash of the question text,
 *  not the array index — DataForSEO may reorder results between fetches). */
export function paaCoverageItems(questions: Array<{ question: string }>): CoverageItem[] {
  return questions.map((q) => ({
    id: `paa-${hashId(q.question)}`,
    label: q.question,
    type: 'paa' as const,
    importance: 'recommended' as const,
    covered: false,
    quality: 0,
  }));
}
```

- [ ] **Step 2: Typecheck** → no new errors. **Step 3: Commit**

```bash
git add lib/seo/keywordData.ts
git commit -m "feat(ai-coverage): paaCoverageItems builder (stable hashed ids)"
```

## Task 5: `ai_info_to_cover` column

**Files:** Modify `lib/ensureArticlesTables.ts`

- [ ] **Step 1: Add the column** — after the `articles` table creation, following the file's existing
  `sql` helper usage:

```ts
await sql`ALTER TABLE articles ADD COLUMN IF NOT EXISTS ai_info_to_cover JSONB`;
```

- [ ] **Step 2: Typecheck + run** `ensureArticlesTables` once (hit an articles API / start dev). No error; column exists.

- [ ] **Step 3: Commit**

```bash
git add lib/ensureArticlesTables.ts
git commit -m "feat(ai-coverage): ai_info_to_cover JSONB column on articles"
```

## Task 6: Compute + store coverage, feed the editor AI gauge

**Files:** Modify `pages/api/articles/deep-analysis.ts`, `pages/articles/[id]/index.tsx`, `components/articles/ContentScorePanel.tsx`

- [ ] **Step 1: deep-analysis** — where plainText + `paa.questions` are known:

```ts
import { paaCoverageItems } from '../../../lib/seo/keywordData';
import { intentItems, checkCoverage, computeCoverageScore, deepseekJudge } from '../../../lib/aiCoverage';

const items = [...paaCoverageItems(paa.questions), ...intentItems()];
const coverage = await checkCoverage(plainText, items, deepseekJudge);
const aiCoverageScore = computeCoverageScore(items, coverage);
const graded = items.map((it) => {
  const v = coverage.items.find((x) => x.id === it.id);
  return { ...it, covered: !!v?.covered, quality: v?.quality ?? 0,
    needsExpansion: v?.needsExpansion, missing: v?.missing, sectionId: v?.sectionId };
});
await sql`UPDATE articles SET ai_info_to_cover = ${JSON.stringify(graded)} WHERE id = ${articleId}`;
// include aiCoverageScore + graded in the JSON response
```

- [ ] **Step 2: editor** (`pages/articles/[id]/index.tsx`) — read `ai_info_to_cover` + score from the
  loaded article into state; pass `aiCoverageScore` to `ContentScorePanel`. Keep `aiVisibilitySummary`
  for the (future) AI Tracker.

- [ ] **Step 3: ContentScorePanel** — add prop `aiCoverageScore?: number`; use it for the AI gauge
  where it currently calls `computeAiSearchScore(aiVisibilitySummary)`:

```tsx
const aiScore = aiCoverageScore ?? (hasAi ? computeAiSearchScore(aiVisibilitySummary) : 0);
```

- [ ] **Step 4: Typecheck** → no new errors.

- [ ] **Step 5: Manual verify** — deep-analysis on an article: AI gauge reflects coverage;
  `ai_info_to_cover` populated (with `missing[]`/`needsExpansion` for #2). Live delta + the
  Information-to-cover panel are #2/#3.

- [ ] **Step 6: Build gate + commit**

```bash
npm run build   # exit 0
git add pages/api/articles/deep-analysis.ts pages/articles/[id]/index.tsx components/articles/ContentScorePanel.tsx
git commit -m "feat(ai-coverage): compute+store coverage, feed editor AI gauge"
```

---

## Final verification
- [ ] `npx jest __tests__/lib/aiCoverage.test.ts --ci` — green (10 tests).
- [ ] `npx tsc --noEmit` — clean. `npm run build` — exit 0. `graphify update .`

## Self-review (spec coverage)
- CoverageItem (type enum + importance + quality + needsExpansion + missing + sectionId) → Tasks 1-2. ✓
- Stable hashed ids → Task 4 (PAA) + `hashId` Task 2. ✓
- LLM judge, quality + missing + needsExpansion → Task 3. ✓
- importance×quality score (85) + early (15) → Task 1. ✓
- Versioned cache (judge.version) → Task 2. ✓
- `ai_info_to_cover` column → Task 5. ✓
- Event-driven compute + feed gauge; `missing[]` stored for #2 → Task 6. ✓
- `aiSearchScore.ts` untouched → no task modifies it. ✓
