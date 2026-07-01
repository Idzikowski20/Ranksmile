# Shared Context (Sub-project B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship one `buildArticleContext(articleId)` helper that assembles a single typed `ArticleContext` (keyword + score data + coverage snapshot + PAA + terms + competitors + brand voice + custom rules), consumed by AI Visibility and (later) the Recommendation Engine / Planner — eliminating per-feature context rebuilds. Also discharge the 4 follow-ups deferred from sub-project A's whole-branch review.

**Architecture:** A new read-only aggregator `lib/articleContext.ts::buildArticleContext(articleId)` that SELECTs (never writes) and reuses A's `parseSnapshot`/`readArticleTerms` + existing `readContentSettings`/`getDomainVoices`/`computeContentScoreBreakdown`. Order: land the 4 small A-follow-up fixes first (they de-risk the coverage path), then the context builder, then refactor `ai-visibility.ts` to consume it.

**Tech Stack:** TypeScript, Next.js (pages), Neon Postgres (JSONB) / SQLite (TEXT) dual-dialect, Sequelize `db.query` with parameterized `replacements`, Python sidecar (FastAPI), Jest.

**Spec:** `docs/superpowers/specs/2026-06-30-shared-context-design.md`
**Depends on:** Sub-project A (merged, PR #9). Reuses `lib/aiCoverage.ts`, `lib/coverageStore.ts`, `lib/articleTerms.ts`, `lib/contentScore.ts` from A.
**Memory:** `[[serpbear-security-audit]]` (aiBudget/recordAiTokens, parameterized queries), `[[deepseek-chat-not-reasoning-model]]`, `[[avoid-any-type]]`, `[[sidecar-repro-script-not-user]]`, `[[concurrent-claude-sessions-hazard]]`.

## Global Constraints

- **Branch:** cut a fresh `feature/shared-context` from updated `main` AFTER PR #9 (sub-project A) merges. Do not start on a branch that lacks A.
- **Commit each task immediately** — the concurrent-session hazard (`[[concurrent-claude-sessions-hazard]]`) nuked an uncommitted working tree once; never leave work uncommitted.
- **All DB access parameterized:** `db.query('... WHERE ${articleIdSql} = ?', { replacements: [...] })` where `articleIdSql = await getArticleIdSql()` (`lib/articleSql.ts`). NEVER string-interpolate a request/id value. Mirror `pages/api/articles/deep-analysis.ts` (A Tasks 10-11).
- **Dual-dialect JSON reads:** `ai_info_to_cover` → `parseSnapshot` (already string-safe from A). Other JSON columns (`score_data`, `article_competitors.*_json`) → `safeJsonParse` (from `lib/safeJson.ts`), which tolerates string OR object.
- **`buildArticleContext` never throws on missing data** — sparse context (`null`/`[]`/`undefined`), never a throw for absent inputs.
- **No new TypeScript `any`** (`[[avoid-any-type]]`).
- **Test isolation:** any test whose import chain pulls in `database/database` (sequelize → uuid ESM) MUST use a LOCAL `jest.mock('../../database/database', ...)` (mirror `__tests__/utils/verifyDomainOwnership.test.ts`). NEVER modify `jest.config.js`/`jest.setup.js`/`__mocks__/` — that global change was explicitly rejected in A's review.
- **`deepseek-chat`, NOT a reasoning model** for any LLM call.
- **Verify gates:** each code task ends with `npx tsc --noEmit` clean; the final task also runs `npm run build` (exit 0). The pre-existing flaky `__tests__/pages/domains.test.tsx` (2 UI tests) is NOT introduced by this work — ignore those 2 if they flake.

---

## File Structure

**Create:**
- `lib/articleContext.ts` — `ArticleContext` type + `buildArticleContext(articleId)`. The aggregator.
- `__tests__/lib/articleContext.test.ts` — unit test with a local DB mock.

**Modify (A-follow-up fixes, Tasks 1–4):**
- `lib/aiCoverage.ts` — verdict shape-validation; replace `verdict.items || []`.
- `pages/api/articles/ai-readability.ts` — generic non-readability preservation in the merge.
- `python-sidecar/analyzers/ai_readability.py` — `_empty()` emits `coverage_items: []`.
- `pages/api/articles/deep-analysis.ts` — budget-gate the coverage block + record token usage.

**Modify (context consumer, Task 7):**
- `pages/api/articles/ai-visibility.ts` — consume `buildArticleContext`.

**Untouched:** A's model/scoring core, editor UI, `collectScoreSlots` dual-read.

---

## Task 1: Harden the judge verdict (shape-validate + surface null items)

Discharges A follow-up #2. A already NaN-guards `quality` (commit `daa6a68`); this finishes per-field validation and makes a null `items` visible instead of silent.

**Files:**
- Modify: `lib/aiCoverage.ts` (the `deepseekJudge.run` parse + the `checkCoverage` verdict handling)
- Test: append to `__tests__/lib/aiCoverage.test.ts`

**Interfaces:**
- Consumes: `CoverageVerdict`, `CoverageResult`, `deepseekJudge`, `checkCoverage` (all existing in `lib/aiCoverage.ts` from A).
- Produces: `sanitizeVerdict(raw: unknown): CoverageVerdict[]` (exported pure helper) used inside `deepseekJudge` and reusable by tests.

- [ ] **Step 1: Write the failing test** (append to `__tests__/lib/aiCoverage.test.ts`)

```ts
import { sanitizeVerdict } from '../../lib/aiCoverage';

describe('sanitizeVerdict', () => {
  it('coerces bad field types to safe defaults, keeps valid rows', () => {
    const out = sanitizeVerdict([
      { id: 'a', covered: true,  quality: 'high', confidence: 2,   missing: ['x', 3, null], sectionId: 5 },
      { id: 'b', covered: 'yes', quality: 4,      confidence: 0.9, missing: 'nope' },
    ]);
    // row a: quality 'high' -> 0; confidence 2 -> clamped 1; missing filtered to ['x']; sectionId 5 (number) -> undefined
    expect(out[0]).toEqual({ id: 'a', covered: true, quality: 0, confidence: 1, missing: ['x'] });
    // row b: covered 'yes' -> true (truthy coerced to boolean); missing 'nope' (non-array) -> undefined
    expect(out[1]).toEqual({ id: 'b', covered: true, quality: 4, confidence: 0.9 });
  });
  it('drops rows without a string id', () => {
    expect(sanitizeVerdict([{ covered: true, quality: 5, confidence: 1 }, { id: 7 }])).toEqual([]);
  });
  it('non-array input -> [] (does not throw)', () => {
    expect(sanitizeVerdict(null)).toEqual([]);
    expect(sanitizeVerdict({ items: [] })).toEqual([]);
    expect(sanitizeVerdict('nope')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run → fail**

Run: `npx jest __tests__/lib/aiCoverage.test.ts -t sanitizeVerdict --ci`
Expected: FAIL — `sanitizeVerdict` is not exported.

- [ ] **Step 3: Implement** — add `sanitizeVerdict` to `lib/aiCoverage.ts` and use it in `deepseekJudge`.

```ts
// lib/aiCoverage.ts (add near the verdict types)
const clamp01 = (n: unknown): number => {
  const x = Number(n);
  return Number.isFinite(x) ? Math.min(Math.max(x, 0), 1) : 0;
};

/** Coerce a raw LLM `items` payload into well-typed CoverageVerdicts. Non-array -> []. Bad fields -> safe defaults.
 *  Rows without a string id are dropped (an id-less verdict can't be matched to an item anyway). */
export function sanitizeVerdict(raw: unknown): CoverageVerdict[] {
  if (!Array.isArray(raw)) return [];
  const out: CoverageVerdict[] = [];
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue;
    const row = r as Record<string, unknown>;
    if (typeof row.id !== 'string') continue;
    const q = Number(row.quality);
    const v: CoverageVerdict = {
      id: row.id,
      covered: !!row.covered,
      quality: Number.isFinite(q) ? Math.min(Math.max(q, 0), 5) : 0,
      confidence: clamp01(row.confidence),
    };
    if (typeof row.needsExpansion === 'boolean') v.needsExpansion = row.needsExpansion;
    if (Array.isArray(row.missing)) {
      const m = row.missing.filter((s): s is string => typeof s === 'string');
      if (m.length) v.missing = m;
    }
    if (typeof row.reason === 'string') v.reason = row.reason;
    if (typeof row.sectionId === 'string') v.sectionId = row.sectionId;
    out.push(v);
  }
  return out;
}
```

In `deepseekJudge.run`, replace the current `items: parsed.items ?? []` mapping with `items: sanitizeVerdict(parsed.items)`. In `checkCoverage`, where it currently does `(verdict.items || [])`, change to `sanitizeVerdict(verdict.items)` if the verdict came from an untyped source, OR — since `judge.run` now returns sanitized items — keep the existing filter but add: if `verdict.items` is not an array, `console.warn('[coverage] judge returned non-array items')` once before treating as empty.

> Read the current `deepseekJudge.run` return + `checkCoverage` body first (`grep -n "parsed.items\|verdict.items" lib/aiCoverage.ts`) and wire `sanitizeVerdict` at both the parse boundary and the null-items guard. Do not double-sanitize in a way that changes valid output.

- [ ] **Step 4: Run → pass**

Run: `npx jest __tests__/lib/aiCoverage.test.ts --ci`
Expected: PASS (all existing + 3 new).

- [ ] **Step 5: Typecheck + commit**

```bash
npx tsc --noEmit
git add lib/aiCoverage.ts __tests__/lib/aiCoverage.test.ts
git commit -m "fix(coverage): sanitize judge verdict fields + surface non-array items (A follow-up)"
```

---

## Task 2: ai-readability merge preserves ALL non-readability item types

Discharges A follow-up #3 (forward-compat data loss). The merge currently enumerates a fixed bucket allow-list; a future `definition`/`comparison`/`example` item would vanish on a readability-only run.

**Files:**
- Modify: `pages/api/articles/ai-readability.ts` (the merge block from A Task 11)
- Test: `__tests__/lib/coverageStore.test.ts` (append — test the merge-preservation contract at the helper level)

**Interfaces:**
- Consumes: `mergeCoverageItems(src: {paa, intent, readability, entity})` (existing, `lib/coverageStore.ts`).
- Produces: no new exports; a corrected merge call site + a regression test pinning "non-readability items survive".

- [ ] **Step 1: Write the failing test** (append to `__tests__/lib/coverageStore.test.ts`)

This pins the CONTRACT the endpoint relies on: merging a fresh readability set with kept items of arbitrary non-readability types preserves them all.

```ts
import { mergeCoverageItems } from '../../lib/coverageStore';
import { CoverageItem } from '../../lib/aiCoverage';

const it = (id: string, type: CoverageItem['type'], category: CoverageItem['category']): CoverageItem =>
  ({ id, label: id, type, category, importance: 'recommended', source: 'llm', covered: true, quality: 5 });

describe('mergeCoverageItems — forward-compat preservation', () => {
  it('keeps future non-readability types (definition/comparison) alongside fresh readability', () => {
    const keptPaa        = it('paa-1', 'paa', 'knowledge');
    const keptDefinition = it('def-1', 'definition', 'knowledge'); // a type A never produced
    const keptComparison = it('cmp-1', 'comparison', 'knowledge');
    const freshReadability = it('readability-x', 'readability', 'quality');
    const merged = mergeCoverageItems({
      paa: [keptPaa],
      intent: [],
      readability: [freshReadability],
      // the endpoint must funnel ALL non-readability kept items through the merge, not just paa/entity/fact:
      entity: [keptDefinition, keptComparison],
    });
    const ids = merged.map((m) => m.id).sort();
    expect(ids).toEqual(['cmp-1', 'def-1', 'paa-1', 'readability-x']);
  });
});
```

- [ ] **Step 2: Run → fail (or pass) + read the endpoint**

Run: `npx jest __tests__/lib/coverageStore.test.ts -t forward-compat --ci`
This helper-level test likely PASSES already (merge just concatenates). Its purpose is to LOCK the contract. The real fix is in the endpoint's bucketing. Read it: `grep -n "type !== 'readability'\|filter((i)\|mergeCoverageItems" pages/api/articles/ai-readability.ts`.

- [ ] **Step 3: Fix the endpoint's keep-filter** — in `pages/api/articles/ai-readability.ts`, the merge currently splits `keep` into `paa`/`intent`/`entity`(+fact) buckets, dropping any other type. Change it to preserve ALL non-readability kept items generically. Replace the per-type re-bucketing with:

```ts
// keep everything that isn't readability; the fresh readabilityItems replace the readability slice.
const keep = prev ? prev.items.filter((i) => i.type !== 'readability') : [];
const merged = mergeCoverageItems({
  paa: keep,               // pass ALL kept non-readability items through one bucket
  intent: [],
  readability: readabilityItems,
  entity: [],
});
```

> `mergeCoverageItems` concatenates + dedupes by id (last wins). Passing all kept items via one bucket preserves every type; the fresh readability items are the only ones in the `readability` bucket, and dedup by id keeps behavior identical for the types A produces. Verify no id collision between kept items and fresh readability ids (readability ids are `readability-*`; kept items are `paa-*`/`intent-*`/`entity-*`/`fact-*`/future — no overlap).

- [ ] **Step 4: Run → pass + typecheck**

Run: `npx jest __tests__/lib/coverageStore.test.ts --ci` → PASS.
Run: `npx tsc --noEmit` → clean.

- [ ] **Step 5: Commit**

```bash
git add pages/api/articles/ai-readability.ts __tests__/lib/coverageStore.test.ts
git commit -m "fix(coverage): ai-readability merge preserves all non-readability item types (A follow-up)"
```

---

## Task 3: sidecar `_empty()` emits `coverage_items: []`

Discharges A follow-up #4 (cosmetic shape consistency).

**Files:**
- Modify: `python-sidecar/analyzers/ai_readability.py`

- [ ] **Step 1: Locate `_empty()`**

Run: `grep -n "_empty\|coverage_items\|return {" python-sidecar/analyzers/ai_readability.py`
Expected: `_empty()` returns `{"score": 0, "criteria": [...]}` (no `coverage_items`), while the happy path (from A Task 7) returns `{"score", "criteria", "coverage_items"}`.

- [ ] **Step 2: Add the key** — in `_empty()`'s return dict, add `"coverage_items": []` so both paths share a shape. Match the file's existing quoting/spacing. Do NOT change `score`/`criteria` or any other function.

- [ ] **Step 3: Smoke test (best-effort)** — reuse the A Task 7 scratch pattern (`[[sidecar-repro-script-not-user]]`):

```bash
cd /c/Users/patry/Desktop/serpbear && python -c "import sys; sys.path.insert(0,'python-sidecar'); from analyzers.ai_readability import _empty; r=_empty(); assert r.get('coverage_items') == [], r; print('ok', list(r.keys()))"
```
Expected: `ok [...]` including `coverage_items`. If `_empty` isn't importable standalone (deps), verify by code inspection and note it.

- [ ] **Step 4: Commit**

```bash
git add python-sidecar/analyzers/ai_readability.py
git commit -m "fix(coverage): ai_readability _empty() emits coverage_items:[] for shape consistency (A follow-up)"
```

---

## Task 4: Budget-gate the coverage LLM calls in deep-analysis

Discharges A follow-up #1. The coverage block (2 deepseek calls) runs after the org 5h token-budget gate; an over-budget org still incurs them, and their tokens aren't recorded.

**Files:**
- Modify: `pages/api/articles/deep-analysis.ts` (the coverage try/catch block from A Task 10)

**Interfaces:**
- Consumes: the repo's existing org-budget check + token recorder. FIRST discover them: `grep -rn "orgBudgetBlocked\|getOrgUsage5h\|recordAiTokens\|aiBudget" lib pages | head`. In A, `optimize-sections.ts` uses `getOrgUsage5h(orgId)` (gate) + `recordAiTokens(orgId, tokens)` (record). Mirror whatever those real helpers are named.
- Produces: no new exports; a gated + accounted coverage block.

- [ ] **Step 1: Read the current gate + coverage block**

Run: `grep -n "orgBudgetBlocked\|getOrgUsage5h\|recordAiTokens\|\\[coverage\\]\|coverageSnapshot" pages/api/articles/deep-analysis.ts`
Identify: (a) the upstream budget gate + the `orgId` variable in scope, (b) the coverage try/catch block (the one that calls `analyzeIntroduction` + `checkCoverage` + `buildSnapshot`).

- [ ] **Step 2: Gate the coverage block** — at the TOP of the coverage try block, before any LLM call, add an over-budget short-circuit that mirrors the handler's existing gate. If the org is over budget, skip the coverage compute entirely (do NOT call the judges; leave the previous snapshot untouched; the gauge falls back). Sketch (adapt to the real helper names):

```ts
try {
  const usage = orgId != null ? await getOrgUsage5h(orgId) : null;
  if (usage?.over) {
    console.warn('[coverage] org over 5h token budget — skipping coverage compute');
  } else {
    // ... existing coverage block: splitSections, analyzeIntroduction, readArticleTerms,
    //     checkCoverage, buildSnapshot, persist ...
  }
} catch (err) {
  console.warn('[coverage] deep-analysis snapshot compute failed', err);
}
```

- [ ] **Step 3: Record coverage token usage** — after the coverage compute succeeds (snapshot persisted), record the tokens the 2 deepseek calls consumed, using the same recorder `optimize-sections.ts` uses. If the deepseek responses expose `usage.total_tokens`, sum them; otherwise estimate conservatively (e.g. a fixed per-call constant matching how the sidecar/optimize path estimates). Read how `optimize-sections.ts` computes `aiTokens` and mirror it:

```ts
// after successful coverage compute, inside the else-branch:
if (orgId != null) {
  const coverageTokens = /* sum of the 2 deepseek responses' usage.total_tokens, or the repo's estimate */;
  if (coverageTokens > 0) await recordAiTokens(orgId, coverageTokens);
}
```

> To capture per-call tokens, `checkCoverage`/`analyzeIntroduction` would need to surface usage. If threading usage out is too invasive for this task, record a conservative FIXED estimate per coverage run (documented) and note that precise accounting is a smaller follow-up. Prefer the accurate path if the deepseek response is already in hand at the call site.

- [ ] **Step 4: Typecheck + build gate**

Run: `npx tsc --noEmit` → clean.
Run: `npm run build` → exit 0 (this touches an API route; confirm it still compiles).

- [ ] **Step 5: Manual-verify note** — DB/LLM/over-budget smoke is deferred (no dev server / DB / API key in env). Verify by code inspection: over-budget → no judge call; under-budget → runs + records. Note in the report.

- [ ] **Step 6: Commit**

```bash
git add pages/api/articles/deep-analysis.ts
git commit -m "fix(coverage): budget-gate + account the 2 coverage LLM calls in deep-analysis (A follow-up)"
```

---

## Task 5: `ArticleContext` type + `buildArticleContext` skeleton (article row + scoreData + coverage)

The core aggregator, built incrementally. Task 5 wires the article row, `scoreData`, `coverage`, `paa`. Task 6 adds terms/competitors/brand/voice.

**Files:**
- Create: `lib/articleContext.ts`
- Test: `__tests__/lib/articleContext.test.ts`

**Interfaces:**
- Consumes: `parseSnapshot` (`lib/coverageStore.ts`), `safeJsonParse` (`lib/safeJson.ts`), `getArticleIdSql` (`lib/articleSql.ts`), `db` (`../database/database`), `ScoreData` (`lib/contentScore.ts`), `CoverageSnapshot` (`lib/coverageStore.ts`/`lib/aiCoverage.ts`).
- Produces: `interface ArticleContext` + `async function buildArticleContext(articleId: number): Promise<ArticleContext>`. Later tasks (C/D) consume `buildArticleContext`.

- [ ] **Step 1: Write the failing test** (with a LOCAL db mock — the import chain hits sequelize)

```ts
// __tests__/lib/articleContext.test.ts
// Local sequelize-chain mock (mirror __tests__/utils/verifyDomainOwnership.test.ts) — NEVER touch global jest infra.
jest.mock('../../database/database', () => ({ __esModule: true, default: { query: jest.fn() } }));
jest.mock('../../lib/articleSql', () => ({ getArticleIdSql: jest.fn(async () => 'id') }));

import db from '../../database/database';
import { buildArticleContext } from '../../lib/articleContext';

const mockQuery = (db as unknown as { query: jest.Mock }).query;

describe('buildArticleContext — core fields', () => {
  beforeEach(() => mockQuery.mockReset());

  it('assembles keyword/scoreData/coverage/paa from the article row; sparse when columns null', async () => {
    // 1st query = article row (Task 5 reads this). Return a minimal row.
    mockQuery.mockResolvedValueOnce([[{
      id: 1, target_keyword: 'react hooks', language: 'en', content_type: 'guide',
      score_data: JSON.stringify({ terms: [], paa_questions: ['What are hooks?'] }),
      ai_info_to_cover: null,        // un-analyzed -> coverage null
    }]]);
    // subsequent queries (terms/competitors in Task 6) — default empty
    mockQuery.mockResolvedValue([[]]);

    const ctx = await buildArticleContext(1);
    expect(ctx.articleId).toBe(1);
    expect(ctx.keyword).toBe('react hooks');
    expect(ctx.language).toBe('en');
    expect(ctx.contentType).toBe('guide');
    expect(ctx.paa).toEqual(['What are hooks?']);
    expect(ctx.coverage).toBeNull();           // parseSnapshot(null) -> null
    expect(typeof ctx.builtAt).toBe('string');
  });

  it('does not throw when the article row is missing', async () => {
    mockQuery.mockResolvedValue([[]]); // no row
    const ctx = await buildArticleContext(999);
    expect(ctx.articleId).toBe(999);
    expect(ctx.keyword).toBe('');
    expect(ctx.coverage).toBeNull();
    expect(ctx.paa).toEqual([]);
  });
});
```

- [ ] **Step 2: Run → fail**

Run: `npx jest __tests__/lib/articleContext.test.ts --ci`
Expected: FAIL — `Cannot find module '../../lib/articleContext'`.

- [ ] **Step 3: Implement the skeleton**

```ts
// lib/articleContext.ts
import db from '../database/database';
import { getArticleIdSql } from './articleSql';
import { safeJsonParse } from './safeJson';
import { parseSnapshot } from './coverageStore';
import type { CoverageSnapshot } from './coverageStore';
import type { ScoreData } from './contentScore';
import type { ArticleTermRow } from './articleTerms';

export interface CompetitorContext {
  domain: string;
  url?: string;
  title?: string;
  headings?: string[];
  termsCount?: number;
}

export interface ArticleContext {
  articleId: number;
  keyword: string;
  language?: string;
  scoreData: ScoreData;
  breakdown: null;                 // wired in a later sub-project if needed; kept null-typed in B
  coverage: CoverageSnapshot | null;
  paa: string[];
  terms: ArticleTermRow[];
  competitors: CompetitorContext[];
  brandKnowledge?: string;
  voiceTone?: string;
  customRules?: string;
  contentType?: string;
  builtAt: string;
}

const EMPTY_SCORE_DATA = { terms: [], paa_questions: [] } as unknown as ScoreData;

/** Read-only aggregator: assembles one ArticleContext from all its DB sources. Never writes. Sparse on missing data. */
export async function buildArticleContext(articleId: number): Promise<ArticleContext> {
  const idSql = await getArticleIdSql();
  const [rows] = (await db.query(
    `SELECT * FROM articles WHERE ${idSql} = ?`,
    { replacements: [articleId] },
  )) as [Array<Record<string, unknown>>, unknown];
  const row = rows?.[0];

  const scoreData = row?.score_data != null
    ? safeJsonParse<ScoreData>(row.score_data as string, EMPTY_SCORE_DATA)
    : EMPTY_SCORE_DATA;
  const coverage = parseSnapshot(row?.ai_info_to_cover);
  const paa = Array.isArray((scoreData as { paa_questions?: unknown }).paa_questions)
    ? ((scoreData as { paa_questions: unknown[] }).paa_questions.filter((q): q is string => typeof q === 'string'))
    : [];

  return {
    articleId,
    keyword: typeof row?.target_keyword === 'string' ? row.target_keyword : '',
    language: typeof row?.language === 'string' ? row.language : undefined,
    scoreData,
    breakdown: null,
    coverage,
    paa,
    terms: [],           // Task 6
    competitors: [],     // Task 6
    contentType: typeof row?.content_type === 'string' ? row.content_type : undefined,
    builtAt: new Date().toISOString(),
  };
}
```

> `safeJsonParse` tolerates both a JSON string (SQLite TEXT) and an already-parsed object (Postgres JSONB) — confirm its signature (`grep -n "export.*safeJsonParse" lib/safeJson.ts`) and that it returns the fallback on a non-parseable value. If the real `articles` keyword column isn't `target_keyword`, use the real column (check `lib/ensureArticlesTables.ts`).

- [ ] **Step 4: Run → pass**

Run: `npx jest __tests__/lib/articleContext.test.ts --ci`
Expected: PASS (2 tests).

- [ ] **Step 5: Typecheck + commit**

```bash
npx tsc --noEmit
git add lib/articleContext.ts __tests__/lib/articleContext.test.ts
git commit -m "feat(context): buildArticleContext skeleton (keyword/scoreData/coverage/paa)"
```

---

## Task 6: `buildArticleContext` — terms, competitors, brand voice, custom rules

Completes the aggregator by reusing A's `readArticleTerms` + the existing content-settings/domain-voice accessors.

**Files:**
- Modify: `lib/articleContext.ts`
- Test: append to `__tests__/lib/articleContext.test.ts`

**Interfaces:**
- Consumes: `readArticleTerms(articleId)` (`lib/articleTerms.ts`, A Task 8); the existing content-settings reader + domain-voice reader (discover exact names — see Step 3).
- Produces: the fully-populated `ArticleContext` (terms/competitors/brandKnowledge/voiceTone/customRules).

- [ ] **Step 1: Discover the real accessors**

Run: `grep -rn "readContentSettings\|contentSettings\|getDomainVoices\|domainVoices\|article_competitors" lib pages | head -20`
Identify: how `pages/api/articles/[id]/generate.ts` reads brand knowledge / voice / instructions (the audit says it inlines `readContentSettings()` + `getDomainVoices(domainId)`), and how `article_competitors` rows are shaped (`terms_json`/`entities_json`).

- [ ] **Step 2: Write the failing test** (append)

```ts
import { readArticleTerms } from '../../lib/articleTerms';
jest.mock('../../lib/articleTerms', () => ({ readArticleTerms: jest.fn(async () => []) }));

describe('buildArticleContext — knowledge + brand inputs', () => {
  beforeEach(() => mockQuery.mockReset());

  it('populates terms (via readArticleTerms) and competitors (from article_competitors rows)', async () => {
    (readArticleTerms as jest.Mock).mockResolvedValueOnce([
      { term: 'hooks', term_type: 'topic', source: 'serp', importance: 3, target_min: 2, target_max: 4, current_count: 1 },
    ]);
    // article row
    mockQuery.mockResolvedValueOnce([[{ id: 1, target_keyword: 'k', score_data: null, ai_info_to_cover: null, domain_id: 7 }]]);
    // competitors query
    mockQuery.mockResolvedValueOnce([[{ domain: 'a.com', url: 'https://a.com/x', title: 'A', headings_json: JSON.stringify(['H1','H2']) }]]);
    // any further queries (content settings / voices) -> empty/no-op; those may be separate helpers, mocked below.
    mockQuery.mockResolvedValue([[]]);

    const ctx = await buildArticleContext(1);
    expect(ctx.terms).toHaveLength(1);
    expect(ctx.terms[0].term).toBe('hooks');
    expect(ctx.competitors[0].domain).toBe('a.com');
    expect(ctx.competitors[0].headings).toEqual(['H1', 'H2']);
  });
});
```

> Adjust the competitor row shape + which query index it is to match the REAL `article_competitors` schema and the order your implementation queries. If brand/voice come from dedicated helpers (not raw `db.query`), mock those helpers instead of a query index.

- [ ] **Step 3: Run → fail**, then **implement** — extend `buildArticleContext`:

```ts
// add imports
import { readArticleTerms } from './articleTerms';
// + the real content-settings / domain-voice imports discovered in Step 1

// inside buildArticleContext, after the article row:
const terms = await readArticleTerms(articleId);

const [compRows] = (await db.query(
  `SELECT domain, url, title, headings_json, terms_json FROM article_competitors WHERE article_id = ?`,
  { replacements: [articleId] },
)) as [Array<Record<string, unknown>>, unknown];
const competitors: CompetitorContext[] = (compRows ?? []).map((c) => ({
  domain: String(c.domain ?? ''),
  url: typeof c.url === 'string' ? c.url : undefined,
  title: typeof c.title === 'string' ? c.title : undefined,
  headings: safeJsonParse<string[]>(c.headings_json as string, []).filter((h): h is string => typeof h === 'string'),
  termsCount: Array.isArray(safeJsonParse<unknown[]>(c.terms_json as string, [])) ? safeJsonParse<unknown[]>(c.terms_json as string, []).length : 0,
}));

// brand / voice / rules — mirror generate.ts's real accessors (names discovered in Step 1):
const brand = await readContentSettings().catch(() => null);
const voices = row?.domain_id != null ? await getDomainVoices(Number(row.domain_id)).catch(() => null) : null;
```

Return them in the object (replace the `terms: []`/`competitors: []` placeholders; add `brandKnowledge`/`customRules` from `brand`, `voiceTone` from `voices`). Use `?? undefined` for absent fields. **Match the real return shapes** of those helpers — do not assume field names; read them in Step 1.

> `article_competitors` column names (`headings_json`? `terms_json`? `entities_json`?) must match `lib/ensureArticlesTables.ts` — verify. If a column doesn't exist, omit that sub-field gracefully.

- [ ] **Step 4: Run → pass** (existing + new). **Typecheck.**

Run: `npx jest __tests__/lib/articleContext.test.ts --ci` → PASS.
Run: `npx tsc --noEmit` → clean.

- [ ] **Step 5: Commit**

```bash
git add lib/articleContext.ts __tests__/lib/articleContext.test.ts
git commit -m "feat(context): buildArticleContext adds terms/competitors/brand/voice/rules"
```

---

## Task 7: Refactor AI Visibility to consume `buildArticleContext`

Proves the helper against a real consumer and removes a duplicate context rebuild (audit weakness #4).

**Files:**
- Modify: `pages/api/articles/ai-visibility.ts`

**Interfaces:**
- Consumes: `buildArticleContext(articleId)` (Task 6).
- Produces: no new exports; the endpoint now sources `keyword`/`competitors`/etc. from the shared context.

- [ ] **Step 1: Read the endpoint**

Run: `grep -n "target_keyword\|competitor\|db.query\|articleId\|buildArticleContext" pages/api/articles/ai-visibility.ts`
Identify every place it independently re-pulls the article row / competitor domains / keyword — those are what `buildArticleContext` replaces.

- [ ] **Step 2: Refactor to the shared context** — near the top of the handler (after `articleId` is validated + access-checked), add `const ctx = await buildArticleContext(articleId);` and replace the endpoint's own article/keyword/competitor reads with `ctx.keyword`, `ctx.competitors`, `ctx.coverage`, etc. Remove the now-orphaned queries/vars that YOUR change made unused (`[[avoid-any-type]]`: delete dead code, don't `any`-cast around it). Preserve all existing behavior — the sidecar call, the `AiVisibilitySummary` persist, and the response must be unchanged in output; only the SOURCE of the inputs changes.

> This is a surgical swap of the input source, not a behavior change. If the endpoint needs a field `ArticleContext` doesn't carry, either add it to `ArticleContext` (and Task 5/6) or keep that one existing read — note which, and prefer extending the context if the field is generally useful.

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit` → clean.
Run: `npm run build` → exit 0.

- [ ] **Step 4: Manual-verify note** — DB/network smoke deferred (no dev server / API key). Verify by inspection: the endpoint's inputs now come from `buildArticleContext`, output shape unchanged. Note it.

- [ ] **Step 5: Commit**

```bash
git add pages/api/articles/ai-visibility.ts
git commit -m "refactor(context): ai-visibility consumes buildArticleContext (removes duplicate context rebuild)"
```

---

## Final verification

- [ ] All coverage + context suites green: `npx jest __tests__/lib/aiCoverage.test.ts __tests__/lib/coverageStore.test.ts __tests__/lib/articleContext.test.ts __tests__/lib/articleTerms.test.ts --ci`.
- [ ] Full suite: `npx jest --ci` — only the pre-existing flaky `__tests__/pages/domains.test.tsx` may fail; everything else green.
- [ ] `npx tsc --noEmit` clean. `npm run build` exit 0.
- [ ] `graphify update .` (per project CLAUDE.md — AST-only, no API cost).
- [ ] Whole-branch review (opus) before merge, focused on: `buildArticleContext` reads match the real DB schema; the AI-Visibility refactor is output-preserving; the 4 A-follow-up fixes are correct + don't regress A's suites; no new `any`; no global jest-infra change.

## Self-review (spec coverage)

- `buildArticleContext(articleId)` + `ArticleContext` shape → Tasks 5-6. ✓
- Reuses `parseSnapshot`/`readArticleTerms`/`safeJsonParse`/content-settings/domain-voice (no reimplementation) → Tasks 5-6. ✓
- Read-only, parameterized, dual-dialect, sparse-on-missing, no `any` → Global Constraints + Tasks 5-6. ✓
- AI-Visibility consumer refactor → Task 7. ✓
- Deferred-from-A #1 budget-gate coverage LLM calls → Task 4. ✓
- Deferred-from-A #2 verdict shape-validation + non-array items surfaced → Task 1. ✓
- Deferred-from-A #3 ai-readability merge preserves all non-readability types → Task 2. ✓
- Deferred-from-A #4 `_empty()` coverage_items → Task 3. ✓
- Out of scope (Recommendation Engine → C; Planner+Outline → D; Graph/sources → E; UI; `usePersist` cosmetic; `coverageCache` already fixed in A) → no tasks. ✓
- Test isolation via LOCAL db mock only (no global jest change) → Global Constraints + Task 5. ✓
