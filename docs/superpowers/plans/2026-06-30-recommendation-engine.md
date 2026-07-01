# Recommendation Engine (Sub-project C) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn a `CoverageSnapshot` into actionable `Recommendation[]` grouped into `GuidelineGroup[]` (the "AI Search Guidelines"), each with a synthesized `instruction` and a projected `+N` lift — **with NO new LLM call** (A already captured `reason`/`missing[]` for exactly this). Render the grouped, actionable view in `WriteOptimizePanel`.

**Architecture:** A pure `lib/recommendationEngine.ts` (`buildInstruction` templates + `buildRecommendations` + `groupRecommendations`) reading A's `CoverageSnapshot`/`CoverageItem` and optionally B's `ArticleContext` for brand/keyword flavor; a pure `lib/coverage/derived/scoreContribution.ts` computing projected lift via A's exported `computeCoverageScores` (graded items + boolean → no judge round-trip). One UI surface (`WriteOptimizePanel`) renders the groups. Recommendations are DERIVED on read — no DB, no migration.

**Tech Stack:** TypeScript, Next.js (pages), Jest. Reuses A (`lib/aiCoverage.ts`, `lib/coverageStore.ts`) + B (`lib/articleContext.ts`).

**Spec:** `docs/superpowers/specs/2026-06-30-recommendation-engine-design.md`
**Depends on:** A (merged #9) + B (PR #10). Cut `feature/recommendation-engine` from `main` AFTER B merges (B is on `main` once #10 lands).
**Memory:** `[[surfy-coverage-direction]]`, `[[avoid-any-type]]`, `[[content-score-gauge-look]]`, `[[deepseek-chat-not-reasoning-model]]` (N/A — C makes no LLM calls).

## Global Constraints

- **Branch:** cut `feature/recommendation-engine` from updated `main` AFTER PR #10 (B) merges. C reuses `buildArticleContext` (B) + `computeCoverageScores`/`CoverageSnapshot` (A).
- **NO new LLM call anywhere in C.** Instructions are synthesized deterministically from the snapshot's captured `reason`/`missing`/`label`/`type`/`category`. This is C's defining constraint.
- **Recommendations are DERIVED, not persisted.** No new DB column/table. `status: applied/dismissed` is transient UI state (see Assumptions).
- No new TypeScript `any` (`[[avoid-any-type]]`).
- Commit each task immediately (`[[concurrent-claude-sessions-hazard]]`).
- Test isolation: pure modules (`recommendationEngine`, `scoreContribution`) import only A/B pure code — NO DB import, so NO jest mock needed. IF a test transitively pulls in `database/database`, use a LOCAL `jest.mock(...)` (mirror `__tests__/utils/verifyDomainOwnership.test.ts`); NEVER touch `jest.config.js`/`jest.setup.js`/`__mocks__/`.
- UI (Task 4): follow `design.md` / CLAUDE.md §6 — inline styles, reuse existing `WriteOptimizePanel` tokens/patterns, no invented colors/radii.
- Verify gates: each code task ends `npx tsc --noEmit` clean; the UI task + final task run `npm run build` (verify by the controller — `npm run build` can hang subagents, so subagents use `tsc` + jest only). Pre-existing flaky `__tests__/pages/domains.test.tsx` (2 UI tests) is NOT ours.

## Assumptions (resolved from the design's open questions — CONFIRM before executing)

1. **`status` persistence: DEFERRED.** C ships `status` as transient UI state (open derived; applied/dismissed in-component). No dismissed-recommendation store. (Revisit if cross-session memory is wanted.)
2. **UI: REPLACE** A's raw per-item cards in `WriteOptimizePanel` with the grouped GuidelineGroup view (that grouped actionable view IS the Surfer target; A's raw cards were interim). The legacy citations fallback (cubic #3) stays for NULL-snapshot articles.
3. **ai-visibility over-fetch cleanup: INCLUDED** as Task 5 (a cheap win the B review flagged; C is the milestone where the real full-context consumer arrives).

If you change any of these, the affected tasks (4 for #2, 5 for #3) adjust.

---

## File Structure

**Create:**
- `lib/coverage/derived/scoreContribution.ts` — `scoreContribution(item, snapshot): number`. The projected-lift helper.
- `lib/recommendationEngine.ts` — `Recommendation`/`GuidelineGroup`/`GuidelineGroupKey` types + `buildInstruction` + `buildRecommendations` + `groupRecommendations`.
- `__tests__/lib/scoreContribution.test.ts`, `__tests__/lib/recommendationEngine.test.ts`.

**Modify:**
- `components/articles/WriteOptimizePanel.tsx` — render `GuidelineGroup[]`.
- `pages/api/articles/ai-visibility.ts` — Task 5 (over-fetch cleanup).

**Untouched:** A's model/scoring core, B's `buildArticleContext`, the judge, the editor gauge.

---

## Task 1: `scoreContribution` (projected lift, pure)

**Files:**
- Create: `lib/coverage/derived/scoreContribution.ts`
- Test: `__tests__/lib/scoreContribution.test.ts`

**Interfaces:**
- Consumes: `CoverageItem`, `CoverageSnapshot`, `computeCoverageScores` (all exported from `lib/aiCoverage.ts`, A).
- Produces: `scoreContribution(item: CoverageItem, snapshot: CoverageSnapshot): number`.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/lib/scoreContribution.test.ts
import { scoreContribution } from '../../lib/coverage/derived/scoreContribution';
import type { CoverageItem, CoverageSnapshot } from '../../lib/aiCoverage';

const item = (id: string, category: CoverageItem['category'], importance: CoverageItem['importance'],
  covered: boolean, quality: number): CoverageItem =>
  ({ id, label: id, type: 'paa', category, importance, source: 'paa', covered, quality });

// Minimal snapshot builder for the test (bypasses buildSnapshot; we only need items + overall + early).
const snap = (items: CoverageItem[], overall: number, early = false): CoverageSnapshot => ({
  schemaVersion: 1, judgeVersion: 'v1', promptVersion: 'v1', model: 'deepseek-chat',
  createdAt: '2026-06-30T00:00:00Z', items, buckets: [], answersMainQuestionEarly: early, overall,
});

describe('scoreContribution', () => {
  it('a fully-covered item contributes 0 (nothing to gain)', () => {
    const a = item('a', 'knowledge', 'recommended', true, 5);
    const s = snap([a], /* overall */ 85);
    expect(scoreContribution(a, s)).toBe(0);
  });
  it('a critical uncovered item contributes more than an optional uncovered item', () => {
    const crit = item('c', 'knowledge', 'critical', false, 0);
    const opt = item('o', 'knowledge', 'optional', false, 0);
    const s = snap([crit, opt], 0);
    expect(scoreContribution(crit, s)).toBeGreaterThan(scoreContribution(opt, s));
  });
  it('intent-answer-early also flips the early-answer bonus in its hypothetical', () => {
    const early = { ...item('intent-answer-early', 'intent', 'critical', false, 0), type: 'intent' as const };
    const s = snap([early], 0, /* early */ false);
    // maxing this item AND flipping early → includes the +15 early bonus, so lift is sizeable
    expect(scoreContribution(early, s)).toBeGreaterThan(15);
  });
});
```

- [ ] **Step 2: Run → fail** — `npx jest __tests__/lib/scoreContribution.test.ts --ci` → `Cannot find module`.

- [ ] **Step 3: Implement**

```ts
// lib/coverage/derived/scoreContribution.ts
import { CoverageItem, CoverageSnapshot, computeCoverageScores } from '../../aiCoverage';

/** Marginal `overall` gain if `item` went to fully-covered (covered:true, quality:5), all else fixed.
 *  Pure — reuses A's scorer on a hypothetical graded-items array; NO judge round-trip. */
export function scoreContribution(item: CoverageItem, snapshot: CoverageSnapshot): number {
  const maxed: CoverageItem[] = snapshot.items.map((it) =>
    it.id === item.id ? { ...it, covered: true, quality: 5 } : it);
  // intent-answer-early ALSO drives the +15 early bonus — flip it in the hypothetical.
  const early = item.id === 'intent-answer-early' ? true : snapshot.answersMainQuestionEarly;
  const hypothetical = computeCoverageScores(maxed, early).overall;
  return Math.max(0, hypothetical - snapshot.overall);
}
```

- [ ] **Step 4: Run → pass** — `npx jest __tests__/lib/scoreContribution.test.ts --ci` → 3 pass.

- [ ] **Step 5: Typecheck + commit**

```bash
npx tsc --noEmit
git add lib/coverage/derived/scoreContribution.ts __tests__/lib/scoreContribution.test.ts
git commit -m "feat(recs): scoreContribution — projected AI-score lift per item (pure, no LLM)"
```

---

## Task 2: `buildInstruction` (deterministic templates, pure)

**Files:**
- Create: `lib/recommendationEngine.ts` (types + `buildInstruction`)
- Test: `__tests__/lib/recommendationEngine.test.ts`

**Interfaces:**
- Consumes: `CoverageItem`, `CoverageType`, `Importance` (from `lib/aiCoverage.ts`); `ArticleContext` (from `lib/articleContext.ts`, B) — optional.
- Produces: `GuidelineGroupKey`, `Recommendation`, `GuidelineGroup` types; `buildInstruction(item, context?): { title: string; instruction: string }`.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/lib/recommendationEngine.test.ts
import { buildInstruction } from '../../lib/recommendationEngine';
import type { CoverageItem } from '../../lib/aiCoverage';

const it_ = (over: Partial<CoverageItem>): CoverageItem =>
  ({ id: 'x', label: 'What is X?', type: 'paa', category: 'knowledge',
     importance: 'recommended', source: 'paa', covered: false, quality: 0, ...over });

describe('buildInstruction', () => {
  it('uncovered paa with missing → "Cover" title + lists missing', () => {
    const r = buildInstruction(it_({ missing: ['dosage', 'side effects'] }));
    expect(r.title).toBe('Cover: What is X?');
    expect(r.instruction).toContain('dosage');
    expect(r.instruction).toContain('side effects');
  });
  it('covered-but-shallow (needsExpansion) → "Expand" title + reason', () => {
    const r = buildInstruction(it_({ covered: true, quality: 2, needsExpansion: true, reason: 'too vague' }));
    expect(r.title).toBe('Expand: What is X?');
    expect(r.instruction).toContain('too vague');
  });
  it('entity → "Use the term"', () => {
    const r = buildInstruction(it_({ type: 'entity', label: 'React Hooks' }));
    expect(r.title).toBe('Use the term: React Hooks');
  });
  it('intent-answer-early → intro rewrite; uses keyword from context when present', () => {
    const r = buildInstruction(
      { ...it_({}), id: 'intent-answer-early', type: 'intent', category: 'intent' },
      { keyword: 'react hooks' } as never);
    expect(r.instruction.toLowerCase()).toContain('react hooks');
  });
  it('never produces a blank instruction even with no missing/reason', () => {
    const r = buildInstruction(it_({ type: 'entity', label: 'X' }));
    expect(r.instruction.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Implement** — add the types + `buildInstruction` to `lib/recommendationEngine.ts`. Use a `Record<CoverageType, (item, ctx) => {title, instruction}>` with a category-level fallback so E's future types slot in. Substitute `{keyword}`/brand only when `context` provides them; omit gracefully otherwise. (Follow the template table in the design doc §"Instruction synthesis".) No LLM. No `any`.

```ts
// lib/recommendationEngine.ts (shape — fill templates per the design's table)
import { CoverageItem, CoverageType, Importance } from './aiCoverage';
import type { ArticleContext } from './articleContext';

export type GuidelineGroupKey = 'intent' | 'knowledge' | 'authority' | 'quality' | 'structure';
export interface Recommendation {
  id: string; coverageItemId: string; group: GuidelineGroupKey; title: string;
  instruction: string; importance: Importance; status: 'open' | 'applied' | 'dismissed';
  projectedLift: number; sectionId?: string;
}
export interface GuidelineGroup {
  key: GuidelineGroupKey; label: string; score: number;
  recommendations: Recommendation[]; covered: number; total: number;
}

const list = (xs?: readonly string[]) => (xs && xs.length ? xs.join(', ') : '');

/** Deterministic title+instruction from a CoverageItem. NO LLM. context flavors it when present. */
export function buildInstruction(item: CoverageItem, context?: ArticleContext): { title: string; instruction: string } {
  // ... per the design table: intent / paa|fact uncovered / paa|fact needsExpansion / entity / readability / authority ...
  // fallback keeps a non-blank instruction for any type.
}
```

- [ ] **Step 4: Run → pass** (5 tests). **Step 5: Typecheck + commit**

```bash
npx tsc --noEmit
git add lib/recommendationEngine.ts __tests__/lib/recommendationEngine.test.ts
git commit -m "feat(recs): buildInstruction — deterministic per-type templates (no LLM)"
```

---

## Task 3: `buildRecommendations` + `groupRecommendations`

**Files:**
- Modify: `lib/recommendationEngine.ts`
- Test: append to `__tests__/lib/recommendationEngine.test.ts`

**Interfaces:**
- Consumes: `CoverageSnapshot`, `CoverageItem` (A); `scoreContribution` (Task 1); `buildInstruction` (Task 2); `ArticleContext` (B, optional).
- Produces: `buildRecommendations(snapshot, context?): Recommendation[]`; `groupRecommendations(recs, snapshot): GuidelineGroup[]`.

- [ ] **Step 1: Write the failing test** (append)

```ts
import { buildRecommendations, groupRecommendations } from '../../lib/recommendationEngine';
import type { CoverageSnapshot, CoverageItem } from '../../lib/aiCoverage';

const ci = (id: string, category: CoverageItem['category'], covered: boolean, quality: number): CoverageItem =>
  ({ id, label: id, type: category === 'intent' ? 'intent' : 'paa', category,
     importance: 'recommended', source: 'paa', covered, quality });
const snapOf = (items: CoverageItem[]): CoverageSnapshot => ({
  schemaVersion: 1, judgeVersion: 'v1', promptVersion: 'v1', model: 'deepseek-chat',
  createdAt: '2026-06-30T00:00:00Z', items,
  buckets: [{ key: 'knowledge', label: 'Knowledge', weight: 2, items: 2, covered: 1, earned: 2, max: 4, score: 50 }] as never,
  answersMainQuestionEarly: false, overall: 40,
});

describe('buildRecommendations', () => {
  it('emits recs only for NOT-fully-covered items (covered && quality>=4 excluded)', () => {
    const strong = ci('strong', 'knowledge', true, 5);
    const weak = ci('weak', 'knowledge', false, 0);
    const shallow = ci('shallow', 'knowledge', true, 2);
    const recs = buildRecommendations(snapOf([strong, weak, shallow]));
    const ids = recs.map((r) => r.coverageItemId).sort();
    expect(ids).toEqual(['shallow', 'weak']);       // 'strong' excluded
    expect(recs.every((r) => r.id === `rec-${r.coverageItemId}`)).toBe(true);
    expect(recs.every((r) => typeof r.projectedLift === 'number')).toBe(true);
  });
});

describe('groupRecommendations', () => {
  it('maps categories to named groups, sets per-group bucket score, sorts by projectedLift desc', () => {
    const items = [ci('k1', 'knowledge', false, 0), ci('i1', 'intent', false, 0)];
    const snap = snapOf(items);
    const groups = groupRecommendations(buildRecommendations(snap), snap);
    const knowledge = groups.find((g) => g.key === 'knowledge');
    expect(knowledge?.label).toBe('Knowledge Coverage');
    expect(knowledge?.score).toBe(50);              // from the bucket
  });
});
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Implement** (append):
- `buildRecommendations(snapshot, context?)`: for each `snapshot.items` where NOT (`covered && quality >= 4`), build `{ id: rec-${item.id}, coverageItemId: item.id, group: categoryToGroup(item), ...buildInstruction(item, context), importance: item.importance, status: 'open', projectedLift: scoreContribution(item, snapshot), sectionId: item.sectionId }`. Skip items whose category maps to no group only if truly ungroupable (shouldn't happen).
- `groupRecommendations(recs, snapshot)`: bucket the recs by `group`; each `GuidelineGroup.score` = the matching `snapshot.buckets.find(b => b.key === bucketForGroup(group))?.score ?? 0`; `covered`/`total` counted from `snapshot.items` in that category; `recommendations` sorted `projectedLift desc`, tie-break `importance` (critical>recommended>optional). Emit all 5 group keys (empty groups with `[]` recs so the UI can show "Authority —").
- `categoryToGroup`: `intent→intent`, `knowledge→knowledge`, `authority→authority`, `quality→quality` (readability) / `structure` for `type==='structure'`. Labels per design.

- [ ] **Step 4: Run → pass. Step 5: Typecheck + commit**

```bash
npx tsc --noEmit
git add lib/recommendationEngine.ts __tests__/lib/recommendationEngine.test.ts
git commit -m "feat(recs): buildRecommendations + groupRecommendations (AI Search Guidelines, derived)"
```

---

## Task 4: Render the AI Search Guidelines in `WriteOptimizePanel`

**Files:**
- Modify: `components/articles/WriteOptimizePanel.tsx`

**Interfaces:**
- Consumes: `buildRecommendations`/`groupRecommendations` (Task 3); the `coverageItems`/`coverageBuckets` props already threaded in (A Task 12/13); the legacy `aiSummary` fallback (cubic #3).
- Produces: the grouped "AI Search Guidelines" UI (replaces A's raw per-item intent/info-to-cover cards).

- [ ] **Step 1: Read `design.md` + the current `WriteOptimizePanel`** — identify the existing card/row/pill styles (status dot `#1AB25E`/muted, pills `borderRadius:9999`, card border `#F4F4F5`) to REUSE. Do not invent tokens.

- [ ] **Step 2: Build the grouped view.** From `coverageItems` + `coverageBuckets`, assemble a `CoverageSnapshot`-shaped object (or thread the parsed snapshot as a prop from `ContentScorePanel` if cleaner — check what's already passed) and call `groupRecommendations(buildRecommendations(snapshot), snapshot)`. Render each `GuidelineGroup`: a header (`label` + `score%` pill + `covered/total`), then its `recommendations` rows (title, the `+{projectedLift}` lift badge in success green, the `instruction` as sub-text, a covered/uncovered dot). Empty groups render a muted "—". This REPLACES the raw intent + info-to-cover cards (Assumption #2).

- [ ] **Step 3: Keep the legacy fallback.** When there's no coverage snapshot (older article), keep the cubic #3 `aiSummary.citations` fallback list — do NOT show empty groups for un-analyzed articles.

- [ ] **Step 4: Remove orphaned code** your change made unused (the old raw per-item render helpers, if fully replaced). `[[avoid-any-type]]`: delete, don't `any`-cast. Keep the SEO term chips + bucket badges intact.

- [ ] **Step 5: Verify** — `npx tsc --noEmit` clean. (Controller runs `npm run build`.) Describe the rendered structure in the report for a human to eyeball vs design.md + `[[content-score-gauge-look]]`.

- [ ] **Step 6: Commit**

```bash
git add components/articles/WriteOptimizePanel.tsx
git commit -m "feat(recs): WriteOptimizePanel renders AI Search Guidelines (grouped, actionable, +N lift)"
```

---

## Task 5: (cleanup) narrow ai-visibility's keyword read (B follow-up)

**Files:**
- Modify: `pages/api/articles/ai-visibility.ts`

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

- [ ] All C suites green: `npx jest __tests__/lib/scoreContribution.test.ts __tests__/lib/recommendationEngine.test.ts --ci`.
- [ ] Full suite: `npx jest --ci` — only the pre-existing flaky `domains.test.tsx` may fail.
- [ ] `npx tsc --noEmit` clean. `npm run build` OK. `graphify update .`.
- [ ] Whole-branch review (opus): NO LLM call introduced anywhere; recommendations derived (no DB); `scoreContribution` correct (fully-covered→0, critical>optional, early special-case); instruction templates never blank; GuidelineGroup mapping + bucket scores correct; UI reuses design.md tokens + keeps the legacy fallback; ai-visibility keyword byte-identical; no new `any`; no global jest-infra change.

## Self-review (spec coverage)

- `scoreContribution` (projected lift, pure, reuses A's scorer) → Task 1. ✓
- `buildInstruction` deterministic templates, NO LLM, context-flavored → Task 2. ✓
- `buildRecommendations` (only not-fully-covered items) + `groupRecommendations` (5 named groups, bucket scores, sorted) → Task 3. ✓
- AI Search Guidelines UI (grouped, actionable, +N), replaces raw cards, keeps legacy fallback → Task 4. ✓
- ai-visibility over-fetch cleanup (B follow-up) → Task 5. ✓
- No new LLM / no DB / recommendations derived → Global Constraints + Tasks 1-3. ✓
- Out of scope (Planner/Outline/Auto-Optimize per-step → D; Fact/Authority sources → E; status persistence deferred) → no tasks. ✓
