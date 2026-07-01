# Recommendation Engine (Sub-project C) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn a `CoverageSnapshot` into actionable `Guideline[]` grouped into `GuidelineGroup[]` (the "AI Search Guidelines"), each with a synthesized checklist `instruction`, an integer projected `+N` lift, a deterministic `effort`, and an `easyWin` flag — **with NO new LLM call** (A already captured `reason`/`missing[]`). Render a Priority strip + value-ordered groups in `WriteOptimizePanel`.

**Architecture:** A pure `lib/recommendationEngine.ts` (`buildInstruction` templates + `effort`/`easyWin` + `buildGuidelines` + `groupGuidelines`) reading A's `CoverageSnapshot`/`CoverageItem` and optionally B's `ArticleContext`; a pure `lib/coverage/derived/scoreContribution.ts` computing projected lift via A's exported `computeCoverageScores` (graded items + boolean → no judge round-trip). One UI surface. Guidelines are DERIVED on read — no DB, no migration.

**Tech Stack:** TypeScript, Next.js (pages), Jest. Reuses A (`lib/aiCoverage.ts`, `lib/coverageStore.ts`) + B (`lib/articleContext.ts`).

**Spec:** `docs/superpowers/specs/2026-06-30-recommendation-engine-design.md` (v2 — plan-review incorporated)
**Depends on:** A (merged #9) + B (PR #10). This branch (`feature/recommendation-engine`) is stacked on B; it merges cleanly once B lands on `main`.

## Global Constraints

- **NO new LLM call anywhere in C.** Instructions are synthesized deterministically from the snapshot's captured `reason`/`missing`/`label`/`type`/`category`. C's defining constraint.
- **Guidelines are DERIVED, not persisted.** No new DB column/table. `status: applied/dismissed` is transient UI state.
- **Naming:** the primary object is `Guideline` (in `GuidelineGroup`). Functions: `buildGuidelines`, `groupGuidelines`. `id = guideline-${coverageItemId}` — do NOT encode `group` into the id (it's a first-class field).
- **`projectedLift` is an integer** — `Math.round(scoreContribution(...))`. UI never sees a float.
- **Sort within a group:** importance (critical>recommended>optional) FIRST, then `projectedLift` desc, then `quality` asc, then `title`.
- No new TypeScript `any` (`[[avoid-any-type]]`). Commit each task immediately (`[[concurrent-claude-sessions-hazard]]`).
- Test isolation: the pure modules import only A/B pure code (no DB) — no jest mock needed. IF a test transitively pulls in `database/database`, use a LOCAL `jest.mock(...)` (mirror `__tests__/utils/verifyDomainOwnership.test.ts`); NEVER touch `jest.config.js`/`jest.setup.js`/`__mocks__/`.
- UI (Task 4): follow `design.md`/CLAUDE.md §6 — inline styles, reuse `WriteOptimizePanel` tokens (status `#1AB25E`, pills `borderRadius:9999`, card `#F4F4F5`), no invented tokens. Ref `[[content-score-gauge-look]]`.
- Verify gates: each code task ends `npx tsc --noEmit` clean + its jest suite. **Subagents must NOT run `npm run build`** (it hangs them — verified during A/B); the controller runs the full build once at the end. Pre-existing flaky `__tests__/pages/domains.test.tsx` (2 tests) is NOT ours.

## Assumptions (from the design's resolved decisions)

1. `status` persistence DEFERRED (transient UI state). 2. UI REPLACES A's raw per-item cards with the grouped guideline view (legacy citations fallback stays for NULL-snapshot articles). 3. ai-visibility over-fetch cleanup INCLUDED (Task 5).

---

## File Structure

**Create:** `lib/coverage/derived/scoreContribution.ts`; `lib/recommendationEngine.ts` (`Guideline`/`GuidelineGroup`/`GuidelineGroupKey`/`GuidelineEffort` types + `buildInstruction` + `effortOf` + `buildGuidelines` + `groupGuidelines`); `__tests__/lib/scoreContribution.test.ts`, `__tests__/lib/recommendationEngine.test.ts`.
**Modify:** `components/articles/WriteOptimizePanel.tsx`; `pages/api/articles/ai-visibility.ts`.
**Untouched:** A's model/scoring core, B's `buildArticleContext`, the judge, the editor gauge.

---

## Task 1: `scoreContribution` (projected lift, pure)

**Files:** Create `lib/coverage/derived/scoreContribution.ts`; Test `__tests__/lib/scoreContribution.test.ts`

**Interfaces:**
- Consumes: `CoverageItem`, `CoverageSnapshot`, `computeCoverageScores` (`lib/aiCoverage.ts`, A).
- Produces: `scoreContribution(item: CoverageItem, snapshot: CoverageSnapshot): number` (already integer — A's scorer rounds; callers may re-round defensively).

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/lib/scoreContribution.test.ts
import { scoreContribution } from '../../lib/coverage/derived/scoreContribution';
import type { CoverageItem, CoverageSnapshot } from '../../lib/aiCoverage';

const item = (id: string, category: CoverageItem['category'], importance: CoverageItem['importance'],
  covered: boolean, quality: number): CoverageItem =>
  ({ id, label: id, type: category === 'intent' ? 'intent' : 'paa', category, importance, source: 'paa', covered, quality });
const snap = (items: CoverageItem[], overall: number, early = false): CoverageSnapshot => ({
  schemaVersion: 1, judgeVersion: 'v1', promptVersion: 'v1', model: 'deepseek-chat',
  createdAt: '2026-06-30T00:00:00Z', items, buckets: [], answersMainQuestionEarly: early, overall,
});

describe('scoreContribution', () => {
  it('fully-covered item → 0', () => {
    const a = item('a', 'knowledge', 'recommended', true, 5);
    expect(scoreContribution(a, snap([a], 85))).toBe(0);
  });
  it('critical uncovered > optional uncovered', () => {
    const crit = item('c', 'knowledge', 'critical', false, 0);
    const opt = item('o', 'knowledge', 'optional', false, 0);
    const s = snap([crit, opt], 0);
    expect(scoreContribution(crit, s)).toBeGreaterThan(scoreContribution(opt, s));
  });
  it('returns an integer', () => {
    const a = item('a', 'knowledge', 'recommended', false, 0);
    expect(Number.isInteger(scoreContribution(a, snap([a], 0)))).toBe(true);
  });
  it('intent-answer-early flips the early bonus in its hypothetical', () => {
    const early = item('intent-answer-early', 'intent', 'critical', false, 0);
    expect(scoreContribution(early, snap([early], 0, false))).toBeGreaterThan(15);
  });
});
```

- [ ] **Step 2: Run → fail** — `npx jest __tests__/lib/scoreContribution.test.ts --ci` → `Cannot find module`.

- [ ] **Step 3: Implement**

```ts
// lib/coverage/derived/scoreContribution.ts
import { CoverageItem, CoverageSnapshot, computeCoverageScores } from '../../aiCoverage';

/** Marginal `overall` gain if `item` went to fully-covered (covered:true, quality:5), all else fixed.
 *  Pure — reuses A's scorer on a hypothetical graded-items array; NO judge round-trip. Integer. */
export function scoreContribution(item: CoverageItem, snapshot: CoverageSnapshot): number {
  const maxed: CoverageItem[] = snapshot.items.map((it) =>
    it.id === item.id ? { ...it, covered: true, quality: 5 } : it);
  const early = item.id === 'intent-answer-early' ? true : snapshot.answersMainQuestionEarly;
  const hypothetical = computeCoverageScores(maxed, early).overall;   // already rounded by A's scorer
  return Math.max(0, Math.round(hypothetical - snapshot.overall));    // explicit round guard
}
```

- [ ] **Step 4: Run → pass** (4 tests). **Step 5: Typecheck + commit**

```bash
npx tsc --noEmit
git add lib/coverage/derived/scoreContribution.ts __tests__/lib/scoreContribution.test.ts
git commit -m "feat(recs): scoreContribution — integer projected AI-score lift per item (pure, no LLM)"
```

---

## Task 2: types + `buildInstruction` (checklist templates) + `effortOf`

**Files:** Create `lib/recommendationEngine.ts` (types + `buildInstruction` + `effortOf`); Test `__tests__/lib/recommendationEngine.test.ts`

**Interfaces:**
- Consumes: `CoverageItem`, `CoverageType`, `Importance` (`lib/aiCoverage.ts`); `ArticleContext` (`lib/articleContext.ts`, B) — optional.
- Produces: `GuidelineGroupKey`, `GuidelineEffort`, `Guideline`, `GuidelineGroup` types; `buildInstruction(item, context?): { title: string; instruction: string }`; `effortOf(item): GuidelineEffort`.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/lib/recommendationEngine.test.ts
import { buildInstruction, effortOf } from '../../lib/recommendationEngine';
import type { CoverageItem } from '../../lib/aiCoverage';

const it_ = (over: Partial<CoverageItem>): CoverageItem =>
  ({ id: 'x', label: 'What is X?', type: 'paa', category: 'knowledge',
     importance: 'recommended', source: 'paa', covered: false, quality: 0, ...over });

describe('buildInstruction', () => {
  it('uncovered paa with missing → "Cover" title + checklist bullets', () => {
    const r = buildInstruction(it_({ missing: ['dosage', 'side effects'] }));
    expect(r.title).toBe('Cover: What is X?');
    expect(r.instruction).toContain('• dosage');
    expect(r.instruction).toContain('• side effects');
  });
  it('needsExpansion → "Expand" title + reason', () => {
    const r = buildInstruction(it_({ covered: true, quality: 2, needsExpansion: true, reason: 'too vague' }));
    expect(r.title).toBe('Expand: What is X?');
    expect(r.instruction).toContain('too vague');
  });
  it('entity → "Use the term"', () => {
    const r = buildInstruction(it_({ type: 'entity', label: 'React Hooks' }));
    expect(r.title).toBe('Use the term: React Hooks');
  });
  it('intent-answer-early uses keyword from context when present', () => {
    const r = buildInstruction(
      { ...it_({}), id: 'intent-answer-early', type: 'intent', category: 'intent' },
      { keyword: 'react hooks' } as never);
    expect(r.instruction.toLowerCase()).toContain('react hooks');
  });
  it('never blank even with no missing/reason', () => {
    expect(buildInstruction(it_({ type: 'entity', label: 'X' })).instruction.length).toBeGreaterThan(0);
  });
});

describe('effortOf', () => {
  it('needsExpansion → Large', () => expect(effortOf(it_({ needsExpansion: true }))).toBe('Large'));
  it('>5 missing → Large', () => expect(effortOf(it_({ missing: ['a','b','c','d','e','f'] }))).toBe('Large'));
  it('3-5 missing → Medium', () => expect(effortOf(it_({ missing: ['a','b','c'] }))).toBe('Medium'));
  it('<=2 missing → Easy', () => expect(effortOf(it_({ missing: ['a','b'] }))).toBe('Easy'));
  it('entity (0 missing) → Easy', () => expect(effortOf(it_({ type: 'entity' }))).toBe('Easy'));
});
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Implement** the types + `buildInstruction` + `effortOf` in `lib/recommendationEngine.ts`, per the design §"Instruction synthesis" + §"effort". Use a `Record<CoverageType, TemplateFn>` with a category fallback so E's types slot in. Render `missing[]` as `• `-bullets (checklist). Substitute `{keyword}`/brand only when `context` provides them. No LLM, no `any`. `effortOf`: `needsExpansion || (missing?.length ?? 0) > 5 → 'Large'`; `3..5 → 'Medium'`; else `'Easy'`.

```ts
// lib/recommendationEngine.ts (types shape — fill per the design table)
import { CoverageItem, CoverageType, Importance } from './aiCoverage';
import type { ArticleContext } from './articleContext';

export type GuidelineGroupKey = 'intent' | 'knowledge' | 'authority' | 'quality' | 'structure';
export type GuidelineEffort = 'Easy' | 'Medium' | 'Large';
export interface Guideline {
  id: string; coverageItemId: string; group: GuidelineGroupKey; title: string; instruction: string;
  importance: Importance; status: 'open' | 'applied' | 'dismissed';
  projectedLift: number; effort: GuidelineEffort; easyWin: boolean; sectionId?: string;
}
export interface GuidelineGroup {
  key: GuidelineGroupKey; label: string; score: number;
  guidelines: Guideline[]; covered: number; total: number;
}

export function effortOf(item: CoverageItem): GuidelineEffort {
  const n = item.missing?.length ?? 0;
  if (item.needsExpansion || n > 5) return 'Large';
  if (n >= 3) return 'Medium';
  return 'Easy';
}

const bullets = (xs?: readonly string[]) => (xs && xs.length ? xs.map((m) => `• ${m}`).join('\n') : '');

export function buildInstruction(item: CoverageItem, context?: ArticleContext): { title: string; instruction: string } {
  // per the design table: intent / paa|fact uncovered (checklist) / paa|fact needsExpansion / entity / readability / authority; fallback never-blank.
}
```

- [ ] **Step 4: Run → pass** (10 tests). **Step 5: Typecheck + commit**

```bash
npx tsc --noEmit
git add lib/recommendationEngine.ts __tests__/lib/recommendationEngine.test.ts
git commit -m "feat(recs): Guideline model + buildInstruction (checklist templates) + effortOf (no LLM)"
```

---

## Task 3: `buildGuidelines` + `groupGuidelines`

**Files:** Modify `lib/recommendationEngine.ts`; Test append to `__tests__/lib/recommendationEngine.test.ts`

**Interfaces:**
- Consumes: `CoverageSnapshot`, `CoverageItem` (A); `scoreContribution` (Task 1); `buildInstruction`/`effortOf` (Task 2); `ArticleContext` (B, optional).
- Produces: `buildGuidelines(snapshot, context?): Guideline[]`; `groupGuidelines(guidelines, snapshot): GuidelineGroup[]`.

- [ ] **Step 1: Write the failing test** (append)

```ts
import { buildGuidelines, groupGuidelines } from '../../lib/recommendationEngine';
import type { CoverageSnapshot, CoverageItem } from '../../lib/aiCoverage';

const ci = (id: string, category: CoverageItem['category'], importance: CoverageItem['importance'],
  covered: boolean, quality: number): CoverageItem =>
  ({ id, label: id, type: category === 'intent' ? 'intent' : 'paa', category, importance, source: 'paa', covered, quality });
const snapOf = (items: CoverageItem[]): CoverageSnapshot => ({
  schemaVersion: 1, judgeVersion: 'v1', promptVersion: 'v1', model: 'deepseek-chat', createdAt: '2026-06-30T00:00:00Z',
  items, buckets: [{ key: 'knowledge', label: 'Knowledge', weight: 2, items: 3, covered: 1, earned: 2, max: 6, score: 50 }] as never,
  answersMainQuestionEarly: false, overall: 40,
});

describe('buildGuidelines', () => {
  it('only NOT-fully-covered items (covered && quality>=4 excluded); stable ids; integer lift; effort/easyWin present', () => {
    const strong = ci('strong', 'knowledge', 'recommended', true, 5);
    const weak = ci('weak', 'knowledge', 'critical', false, 0);
    const shallow = ci('shallow', 'knowledge', 'recommended', true, 2);
    const gs = buildGuidelines(snapOf([strong, weak, shallow]));
    expect(gs.map((g) => g.coverageItemId).sort()).toEqual(['shallow', 'weak']);
    expect(gs.every((g) => g.id === `guideline-${g.coverageItemId}`)).toBe(true);
    expect(gs.every((g) => Number.isInteger(g.projectedLift))).toBe(true);
    expect(gs.every((g) => ['Easy','Medium','Large'].includes(g.effort))).toBe(true);
    expect(gs.every((g) => typeof g.easyWin === 'boolean')).toBe(true);
  });
});

describe('groupGuidelines', () => {
  it('maps to named groups, per-group bucket score, importance-first sort', () => {
    const crit = ci('k-crit', 'knowledge', 'critical', false, 0);
    const rec = ci('k-rec', 'knowledge', 'recommended', false, 0);
    const snap = snapOf([crit, rec]);
    const groups = groupGuidelines(buildGuidelines(snap), snap);
    const knowledge = groups.find((g) => g.key === 'knowledge');
    expect(knowledge?.label).toBe('Knowledge Coverage');
    expect(knowledge?.score).toBe(50);
    // importance-first: the critical guideline sorts before the recommended one
    expect(knowledge?.guidelines[0].coverageItemId).toBe('k-crit');
  });
  it('emits all 5 group keys (empty groups included for the UI)', () => {
    const groups = groupGuidelines([], snapOf([]));
    expect(groups.map((g) => g.key).sort()).toEqual(['authority','intent','knowledge','quality','structure']);
  });
});
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Implement** (append):
- `categoryToGroup(item)`: `intent→'intent'`, `knowledge→'knowledge'`, `authority→'authority'`, `quality→'quality'` (or `'structure'` when `item.type==='structure'`).
- `buildGuidelines(snapshot, context?)`: for each `snapshot.items` where NOT (`covered && quality>=4`): `const lift = scoreContribution(item, snapshot); { id: guideline-${item.id}, coverageItemId: item.id, group: categoryToGroup(item), ...buildInstruction(item, context), importance: item.importance, status: 'open', projectedLift: lift, effort: effortOf(item), easyWin: lift >= 8 && (item.missing?.length ?? 0) <= 2, sectionId: item.sectionId }`.
- `groupGuidelines(guidelines, snapshot)`: emit all 5 group keys with labels ('Intent Alignment'/'Knowledge Coverage'/'Authority'/'Content Quality'/'Structure'); each group's `score` = `snapshot.buckets.find(b => b.key === bucketForGroup(key))?.score ?? 0` (intent/knowledge/authority/quality map to the same-named bucket; structure → quality bucket); `covered`/`total` from `snapshot.items` in that category; `guidelines` sorted **importance-first** (critical>recommended>optional via a weight map) then `projectedLift` desc then `quality` asc then `title`.

- [ ] **Step 4: Run → pass. Step 5: Typecheck + commit**

```bash
npx tsc --noEmit
git add lib/recommendationEngine.ts __tests__/lib/recommendationEngine.test.ts
git commit -m "feat(recs): buildGuidelines + groupGuidelines (AI Search Guidelines, importance-first, derived)"
```

---

## Task 4: Render the AI Search Guidelines in `WriteOptimizePanel`

**Files:** Modify `components/articles/WriteOptimizePanel.tsx`

**Interfaces:**
- Consumes: `buildGuidelines`/`groupGuidelines` (Task 3); the `coverageItems`/`coverageBuckets` props already threaded in (A Task 12/13); the legacy `aiSummary` fallback (cubic #3).
- Produces: the "AI Search Guidelines" UI — a Priority strip + value-ordered groups.

- [ ] **Step 1: Read `design.md` + the current `WriteOptimizePanel`** — identify the existing card/row/pill styles to REUSE (status dot `#1AB25E`/muted, pills `borderRadius:9999`, card border `#F4F4F5`). Do not invent tokens.

- [ ] **Step 2: Assemble the guidelines.** From `coverageItems` + `coverageBuckets`, reconstruct a `CoverageSnapshot`-shaped object (or thread the parsed snapshot as a prop from `ContentScorePanel` if cleaner — check what's already passed) and call `groupGuidelines(buildGuidelines(snapshot), snapshot)`.

- [ ] **Step 3: Render (design §UI).**
  - **Priority strip** on top: the top ~3–5 guidelines by `projectedLift` across ALL groups, each with `+{lift}`, `effort` chip, and the "Easy win" badge when `easyWin`.
  - **Then groups, ordered by value** (weakest `score` first, or by total open-lift) — NOT five fixed equal sections. Each group: header (label + `score%` pill + `covered/total`), then its sorted guideline rows.
  - **Row:** covered/uncovered dot · title · `+{projectedLift}` (success green) · `effort` chip · "Easy win" badge when set · `instruction` as sub-text (render the `• ` checklist lines as a list).
  - Empty groups render a muted "—".

- [ ] **Step 4: Keep the legacy fallback.** NULL-snapshot article → keep the cubic #3 `aiSummary.citations` list; do NOT show empty groups for un-analyzed articles.

- [ ] **Step 5: Remove orphaned code** your change made unused (the old raw per-item render helpers, if fully replaced). Keep the SEO term chips + bucket badges intact. `[[avoid-any-type]]`: delete, don't `any`-cast.

- [ ] **Step 6: Verify** — `npx tsc --noEmit` clean. Describe the rendered structure in the report for a human to eyeball vs design.md + `[[content-score-gauge-look]]`. (Controller runs `npm run build`.)

- [ ] **Step 7: Commit**

```bash
git add components/articles/WriteOptimizePanel.tsx
git commit -m "feat(recs): WriteOptimizePanel renders AI Search Guidelines (Priority strip + groups, +N/effort/easy-win)"
```

---

## Task 5: (cleanup) narrow ai-visibility's keyword read (B follow-up)

**Files:** Modify `pages/api/articles/ai-visibility.ts`

- [ ] **Step 1: Read the current usage** — `grep -n "buildArticleContext\|ctx.keyword\|target_keyword" pages/api/articles/ai-visibility.ts`. The endpoint calls the full `buildArticleContext` (4-5 SELECTs + a settings read) only to read `ctx.keyword`, while `article.target_keyword` is already loaded on the row.

- [ ] **Step 2: Replace** the `buildArticleContext` call with the already-loaded `article.target_keyword` (preserving the exact `|| article.title || ''` fallback that produces the byte-identical keyword). Remove the now-unused `buildArticleContext` import. Confirm the sidecar payload + response + `persistAiVisibilityRun` keyword are unchanged (they already were, per B Task 7 — this only removes the over-fetch).

- [ ] **Step 3: Verify** — `npx tsc --noEmit` clean. Confirm by inspection the keyword value is identical; describe before/after in the report.

- [ ] **Step 4: Commit**

```bash
git add pages/api/articles/ai-visibility.ts
git commit -m "perf(recs): ai-visibility reads target_keyword directly (drop buildArticleContext over-fetch)"
```

---

## Final verification

- [ ] C suites green: `npx jest __tests__/lib/scoreContribution.test.ts __tests__/lib/recommendationEngine.test.ts --ci`.
- [ ] Full suite: `npx jest --ci` — only the pre-existing flaky `domains.test.tsx` may fail.
- [ ] `npx tsc --noEmit` clean. `npm run build` OK. `graphify update .`.
- [ ] Whole-branch review (opus): NO LLM call introduced; guidelines derived (no DB); `scoreContribution` correct (fully-covered→0, critical>optional, early special-case, integer); instruction never blank + missing rendered as checklist; `effort`/`easyWin` thresholds correct; GuidelineGroup mapping + bucket scores + **importance-first sort** correct; UI Priority strip + value-ordered groups + reuses design.md tokens + keeps legacy fallback; ai-visibility keyword byte-identical; no new `any`; no global jest-infra change.

## Self-review (spec coverage)

- `scoreContribution` (integer projected lift, pure, reuses A's scorer, early special-case) → Task 1. ✓
- `Guideline` model + `buildInstruction` checklist templates (NO LLM) + `effortOf` deterministic → Task 2. ✓
- `easyWin` (`lift>=8 && missing<=2`) → Task 3. ✓
- `buildGuidelines` (only not-fully-covered; `guideline-${id}`; integer lift) + `groupGuidelines` (5 named groups, bucket scores, **importance-first** sort) → Task 3. ✓
- AI Search Guidelines UI (Priority strip + value-ordered groups + `+N`/effort/easy-win), replaces raw cards, keeps legacy fallback → Task 4. ✓
- ai-visibility over-fetch cleanup (B follow-up) → Task 5. ✓
- No new LLM / no DB / guidelines derived → Global Constraints + Tasks 1-3. ✓
- Push-back honored: `id` = `guideline-${coverageItemId}` (group not duplicated into id). ✓
- Out of scope (Planner/Outline/Auto-Optimize per-step → D; Fact/Authority sources → E; status persistence deferred) → no tasks. ✓
