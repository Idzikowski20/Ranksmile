# AI Search Coverage Model (Sub-project #1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the editor's AI Search Score reflect content coverage of an "Information to cover" list (People Also Ask + 4 fixed intents), scored by an LLM judge, replacing the citation-based score in the editor gauge.

**Architecture:** A new pure-ish module `lib/aiCoverage.ts` holds the `InfoItem` model, a `checkCoverage(plainText, items, judge)` that calls an injected LLM judge (default = deepseek-chat) and caches by content hash, and a pure `computeCoverageScore`. PAA questions come from the existing `lib/seo/keywordData.ts` DataForSEO fetch; the 4 intents are fixed. Coverage is stored on the article (`ai_info_to_cover` JSON column) and computed event-driven (load / deep-analysis / after an Auto-Optimize section). The citation-based `lib/aiSearchScore.ts` is untouched (becomes the separate "AI Tracker").

**Tech Stack:** TypeScript, Next.js (pages router), Neon Postgres, deepseek-chat (via fetch, same as `pages/api/articles/optimize-sections.ts`), Jest.

**Spec:** `docs/superpowers/specs/2026-06-30-ai-search-coverage-model-design.md`

**Prereqs/cautions:** On branch `feature/gsap-motion-polish`; a concurrent session has edited Auto-Optimize files — coordinate (one writer). Tests: `npx jest <path> --ci`. Use `deepseek-chat`, NOT a reasoning model (project memory: the reasoning model's thinking block eats max_tokens → empty output). Reuse `lib/safeJson.ts`.

---

## File Structure

- `lib/aiCoverage.ts` — **Create.** Types (`InfoItem`, `CoverageResult`, `CoverageJudge`), `intentItems()`, `checkCoverage()`, `computeCoverageScore()`, `deepseekJudge`.
- `__tests__/lib/aiCoverage.test.ts` — **Create.** Pure-logic + stub-judge tests.
- `lib/seo/keywordData.ts` — **Modify.** Export `paaInfoItems(questions)` that maps PAA questions → `InfoItem[]`.
- `lib/ensureArticlesTables.ts` — **Modify.** Add `ai_info_to_cover` JSON column to `articles` (follow the existing add-column pattern).
- `pages/api/articles/deep-analysis.ts` — **Modify.** Build info-to-cover (PAA + intents), run `checkCoverage`, persist `ai_info_to_cover` + the coverage AI score.
- `pages/articles/[id]/index.tsx` + `components/articles/ContentScorePanel.tsx` — **Modify.** Feed the editor AI gauge from the stored coverage score instead of `computeAiSearchScore(aiVisibilitySummary)`.

---

## Task 1: Pure score + types

**Files:**
- Create: `lib/aiCoverage.ts`
- Test: `__tests__/lib/aiCoverage.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/lib/aiCoverage.test.ts
import { computeCoverageScore, CoverageResult } from '../../lib/aiCoverage';

const res = (covered: number, total: number, early: boolean): CoverageResult => ({
  items: Array.from({ length: total }, (_, i) => ({ id: `i${i}`, covered: i < covered })),
  answersMainQuestionEarly: early,
});

describe('computeCoverageScore', () => {
  it('is 0 with no items', () => expect(computeCoverageScore(res(0, 0, false), 0)).toBe(0));
  it('full coverage + early = 100', () => expect(computeCoverageScore(res(4, 4, true), 4)).toBe(100));
  it('full coverage, no early = 80', () => expect(computeCoverageScore(res(4, 4, false), 4)).toBe(80));
  it('half coverage + early = 60', () => expect(computeCoverageScore(res(2, 4, true), 4)).toBe(60));
  it('clamps ratio to total, not verdict count', () => expect(computeCoverageScore(res(2, 2, false), 4)).toBe(40));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/lib/aiCoverage.test.ts --ci`
Expected: FAIL — `Cannot find module '../../lib/aiCoverage'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/aiCoverage.ts
export type InfoKind = 'paa' | 'intent';

export interface InfoItem {
  id: string;
  label: string;
  kind: InfoKind;
  covered: boolean;
  section?: string;
}

export interface CoverageVerdict { id: string; covered: boolean; section?: string; }
export interface CoverageResult { items: CoverageVerdict[]; answersMainQuestionEarly: boolean; }

/** AI Search Score from coverage: covered-ratio (80%) + answer-main-question-early bonus (20%). */
export function computeCoverageScore(result: CoverageResult, total: number): number {
  const covered = result.items.filter((v) => v.covered).length;
  const coveredRatio = total > 0 ? covered / total : 0;
  const earlyBonus = result.answersMainQuestionEarly ? 1 : 0;
  return Math.round(coveredRatio * 80 + earlyBonus * 20);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/lib/aiCoverage.test.ts --ci`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/aiCoverage.ts __tests__/lib/aiCoverage.test.ts
git commit -m "feat(ai-coverage): InfoItem types + computeCoverageScore (pure)"
```

## Task 2: checkCoverage with injected judge + cache

**Files:**
- Modify: `lib/aiCoverage.ts`
- Test: `__tests__/lib/aiCoverage.test.ts` (append)

- [ ] **Step 1: Write the failing test** (append)

```ts
import { checkCoverage, intentItems, InfoItem, CoverageJudge } from '../../lib/aiCoverage';

const items: InfoItem[] = [
  { id: 'paa-1', label: 'Q1?', kind: 'paa', covered: false },
  { id: 'intent-why', label: 'Why', kind: 'intent', covered: false },
];

describe('checkCoverage', () => {
  it('returns empty for no items without calling the judge', async () => {
    const judge = jest.fn();
    const r = await checkCoverage('text', [], judge as unknown as CoverageJudge);
    expect(r).toEqual({ items: [], answersMainQuestionEarly: false });
    expect(judge).not.toHaveBeenCalled();
  });

  it('maps the judge verdict, dropping unknown + duplicate ids', async () => {
    const judge: CoverageJudge = async () => ({
      items: [
        { id: 'paa-1', covered: true, section: 'Intro' },
        { id: 'paa-1', covered: false },     // duplicate → dropped
        { id: 'ghost', covered: true },      // unknown → dropped
      ],
      answersMainQuestionEarly: true,
    });
    const r = await checkCoverage('the article body', items, judge);
    expect(r.items).toEqual([{ id: 'paa-1', covered: true, section: 'Intro' }]);
    expect(r.answersMainQuestionEarly).toBe(true);
  });

  it('caches by content hash (judge called once for same text+items)', async () => {
    const judge = jest.fn(async () => ({ items: [], answersMainQuestionEarly: false }));
    await checkCoverage('same body', items, judge);
    await checkCoverage('same body', items, judge);
    expect(judge).toHaveBeenCalledTimes(1);
  });

  it('intentItems() returns the 4 fixed intents', () => {
    expect(intentItems().map((i) => i.id)).toEqual([
      'intent-answer-main', 'intent-expectations', 'intent-who', 'intent-why',
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/lib/aiCoverage.test.ts --ci`
Expected: FAIL — `checkCoverage`/`intentItems` not exported.

- [ ] **Step 3: Write minimal implementation** (append to `lib/aiCoverage.ts`)

```ts
export type CoverageJudge = (
  plainText: string,
  items: Array<Pick<InfoItem, 'id' | 'label' | 'kind'>>,
) => Promise<CoverageResult>;

const INTENT_ITEMS: ReadonlyArray<Omit<InfoItem, 'covered'>> = [
  { id: 'intent-answer-main', label: 'Answer the main question', kind: 'intent' },
  { id: 'intent-expectations', label: 'Set expectations for the content', kind: 'intent' },
  { id: 'intent-who', label: "Identify who it's for", kind: 'intent' },
  { id: 'intent-why', label: 'Explain why it matters to the reader', kind: 'intent' },
];

/** The 4 fixed search intents, fresh (covered:false) each call. */
export function intentItems(): InfoItem[] {
  return INTENT_ITEMS.map((i) => ({ ...i, covered: false }));
}

// djb2 — cheap deterministic content hash for the per-article coverage cache.
function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i += 1) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

const coverageCache = new Map<string, CoverageResult>();

/**
 * Run the injected judge over the article text + items, returning per-item verdicts.
 * Unknown / duplicate verdict ids are dropped. Cached by (item ids, text hash) so the same
 * content isn't re-judged. Empty items → no judge call.
 */
export async function checkCoverage(
  plainText: string,
  items: InfoItem[],
  judge: CoverageJudge,
): Promise<CoverageResult> {
  if (!items.length) return { items: [], answersMainQuestionEarly: false };
  const key = `${items.map((i) => i.id).join(',')}::${hash(plainText)}`;
  const cached = coverageCache.get(key);
  if (cached) return cached;

  const verdict = await judge(plainText, items.map((i) => ({ id: i.id, label: i.label, kind: i.kind })));
  const known = new Set(items.map((i) => i.id));
  const seen = new Set<string>();
  const verdicts = (verdict.items || []).filter((v) => {
    if (!known.has(v.id) || seen.has(v.id)) return false;
    seen.add(v.id);
    return true;
  });
  const out: CoverageResult = { items: verdicts, answersMainQuestionEarly: !!verdict.answersMainQuestionEarly };
  coverageCache.set(key, out);
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/lib/aiCoverage.test.ts --ci`
Expected: PASS (9 tests total).

- [ ] **Step 5: Commit**

```bash
git add lib/aiCoverage.ts __tests__/lib/aiCoverage.test.ts
git commit -m "feat(ai-coverage): checkCoverage (injected judge + cache) + intentItems"
```

## Task 3: deepseek judge (default LLM)

**Files:**
- Modify: `lib/aiCoverage.ts`

> No unit test — it's a network call. Mirror the auth/endpoint of `pages/api/articles/optimize-sections.ts` (deepseek-chat). Verified via tsc + manual.

- [ ] **Step 1: Add the judge** (append to `lib/aiCoverage.ts`)

```ts
import { safeJsonParse } from './safeJson';

/** Default judge: one deepseek-chat call returning a strict JSON coverage verdict. */
export const deepseekJudge: CoverageJudge = async (plainText, items) => {
  const list = items.map((i) => `- ${i.id} [${i.kind}]: ${i.label}`).join('\n');
  const system = 'You are an SEO content auditor. Decide, strictly from the article, which items are '
    + 'covered. Respond ONLY with JSON.';
  const user = `Items to cover:\n${list}\n\n`
    + 'For each item id decide covered (true/false) and, if covered, the heading "section" it is '
    + 'covered under. Also decide answersMainQuestionEarly: does the FIRST paragraph directly answer '
    + 'the main question?\n\nReturn JSON: '
    + '{"items":[{"id":string,"covered":boolean,"section":string?}],"answersMainQuestionEarly":boolean}.\n\n'
    + `=== ARTICLE START ===\n${plainText}\n=== ARTICLE END ===`;

  const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}` },
    body: JSON.stringify({
      model: 'deepseek-chat',
      response_format: { type: 'json_object' },
      temperature: 0,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    }),
  });
  const data = await res.json().catch(() => ({}));
  const content: string = data?.choices?.[0]?.message?.content ?? '';
  const parsed = safeJsonParse<{ items?: CoverageVerdict[]; answersMainQuestionEarly?: boolean }>(content, {});
  return { items: parsed.items ?? [], answersMainQuestionEarly: !!parsed.answersMainQuestionEarly };
};
```

> If `safeJsonParse`'s signature differs, check `lib/safeJson.ts` and adapt the call (it exists per the repo).

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors. (If `DEEPSEEK_API_KEY` is the wrong env name, grep `optimize-sections.ts` for the exact key/header and match it.)

- [ ] **Step 3: Commit**

```bash
git add lib/aiCoverage.ts
git commit -m "feat(ai-coverage): deepseek-chat judge (default CoverageJudge)"
```

## Task 4: PAA → InfoItem builder

**Files:**
- Modify: `lib/seo/keywordData.ts`

The PAA fetch returns `{ questions: Array<{ question: string; ... }> }`. Expose a mapper.

- [ ] **Step 1: Add the export** (near the PAA usage in `lib/seo/keywordData.ts`)

```ts
import { InfoItem } from '../aiCoverage';

/** Map People-Also-Ask questions to coverage InfoItems (stable id from index). */
export function paaInfoItems(questions: Array<{ question: string }>): InfoItem[] {
  return questions.map((q, i) => ({
    id: `paa-${i}`,
    label: q.question,
    kind: 'paa' as const,
    covered: false,
  }));
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add lib/seo/keywordData.ts
git commit -m "feat(ai-coverage): paaInfoItems builder from People-Also-Ask"
```

## Task 5: `ai_info_to_cover` column

**Files:**
- Modify: `lib/ensureArticlesTables.ts`

The `articles` table is created with `CREATE TABLE IF NOT EXISTS`. Add a nullable JSON column for the
stored coverage, following the same add-column approach already used for other late-added article
columns (e.g. an `ALTER TABLE articles ADD COLUMN IF NOT EXISTS ...` block).

- [ ] **Step 1: Add the migration** — after the `articles` table creation, add:

```ts
await sql`ALTER TABLE articles ADD COLUMN IF NOT EXISTS ai_info_to_cover JSONB`;
```

(Use the project's existing `sql`/query helper exactly as the surrounding statements in the file do.)

- [ ] **Step 2: Typecheck + verify it runs**

Run: `npx tsc --noEmit` then trigger `ensureArticlesTables` once (e.g. start the dev server / hit an
articles API). Expected: no error; the column exists.

- [ ] **Step 3: Commit**

```bash
git add lib/ensureArticlesTables.ts
git commit -m "feat(ai-coverage): ai_info_to_cover JSONB column on articles"
```

## Task 6: Compute + store coverage, feed the editor AI gauge

**Files:**
- Modify: `pages/api/articles/deep-analysis.ts`
- Modify: `pages/articles/[id]/index.tsx`
- Modify: `components/articles/ContentScorePanel.tsx`

- [ ] **Step 1: In `deep-analysis.ts`** — where the article text + PAA are available, build items, judge,
  persist, and include the coverage score in the response. Add:

```ts
import { paaInfoItems } from '../../../lib/seo/keywordData';
import { intentItems, checkCoverage, computeCoverageScore, deepseekJudge } from '../../../lib/aiCoverage';

// after plainText + paa.questions are known:
const items = [...paaInfoItems(paa.questions), ...intentItems()];
const coverage = await checkCoverage(plainText, items, deepseekJudge);
const aiCoverageScore = computeCoverageScore(coverage, items.length);
const storedItems = items.map((it) => {
  const v = coverage.items.find((x) => x.id === it.id);
  return { ...it, covered: !!v?.covered, section: v?.section };
});
await sql`UPDATE articles SET ai_info_to_cover = ${JSON.stringify(storedItems)} WHERE id = ${articleId}`;
// include aiCoverageScore + storedItems in the JSON response
```

- [ ] **Step 2: In the editor (`pages/articles/[id]/index.tsx`)** — read the stored `ai_info_to_cover`
  + coverage score from the article load, hold it in state, and pass an `aiScore` to `ContentScorePanel`
  (replacing the citation-derived value for the gauge). Keep `aiVisibilitySummary` for the AI Tracker.

```tsx
// from the loaded article: article.ai_info_to_cover, article.ai_coverage_score (or recompute via computeCoverageScore)
<ContentScorePanel ... aiCoverageScore={aiCoverageScore} infoToCover={infoToCover} />
```

- [ ] **Step 3: In `ContentScorePanel.tsx`** — add props `aiCoverageScore?: number` and
  `infoToCover?: InfoItem[]`; use `aiCoverageScore` for the AI gauge value where it currently calls
  `computeAiSearchScore(aiVisibilitySummary)`. Leave the citation path for the (future) AI Tracker.

```tsx
const aiScore = aiCoverageScore ?? (hasAi ? computeAiSearchScore(aiVisibilitySummary) : 0);
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Manual verify** — run deep-analysis on an article; the AI Search gauge reflects
  info-to-cover coverage; `ai_info_to_cover` is populated in the DB. (Live delta during Auto-Optimize
  + the Information-to-cover panel are sub-projects #2/#3.)

- [ ] **Step 6: Build gate + commit**

```bash
npm run build   # expect exit 0
git add pages/api/articles/deep-analysis.ts pages/articles/[id]/index.tsx components/articles/ContentScorePanel.tsx
git commit -m "feat(ai-coverage): compute+store coverage, feed editor AI gauge"
```

---

## Final verification
- [ ] `npx jest __tests__/lib/aiCoverage.test.ts --ci` — green (9 tests).
- [ ] `npx tsc --noEmit` — clean.
- [ ] `npm run build` — exit 0.
- [ ] `graphify update .`

## Self-review (spec coverage)
- InfoItem model (PAA + 4 intents) → Tasks 1, 2, 4. ✓
- LLM-judge coverage → Task 2 (injected) + Task 3 (deepseek). ✓
- `computeCoverageScore` (ratio*80 + early*20) → Task 1. ✓
- `ai_info_to_cover` column → Task 5. ✓
- Event-driven compute + feed gauge → Task 6 (deep-analysis; per-section live + manual refresh are #2/#3). ✓
- Citation `aiSearchScore.ts` untouched → confirmed (no task modifies it). ✓
- Tests: pure score, stub-judge mapping/cache, intent ids → Tasks 1-2. ✓
