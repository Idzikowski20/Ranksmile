# Planner + Auto-Optimize Wiring (Sub-project D) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn C's `Guideline[]` into a per-section **Plan** so Auto-Optimize sends each non-skipped section a targeted, cost-aware prompt, skips already-covered sections for free, routes guidelines to the sections they belong to (deterministic scoring with observable confidence + reason), aggregates lift with diminishing returns, and gates the run on ROI against the remaining token budget — **with NO new LLM call for planning** (the LLM is still called once per non-skipped section for the actual edit, exactly as today).

**Architecture:** Two pure modules + endpoint rewiring. `lib/optimizeGuidelineRouting.ts` (`assignGuidelinesToSections` — a per-(guideline,section) scoring model -> highest-scoring section, with fallback + `confidence` + `reason` + `priority`, behind a swappable seam). `lib/optimizationPlanner.ts` (`buildOptimizationPlan` PURE, `buildStepPrompt`, `estimateStepTokens`, focus rules, diminishing-returns lift, ROI trim, types). `pages/api/articles/optimize-sections.ts` gathers inputs SERVER-SIDE (`buildArticleContext` + local `computeContentScoreBreakdown`) and iterates `plan.steps` instead of raw `sections`.

**Tech Stack:** TypeScript, Next.js (pages), Jest, cheerio. Reuses A (`lib/aiCoverage.ts`), B (`lib/articleContext.ts`), C (`lib/recommendationEngine.ts`), and existing optimize primitives (`lib/articleSections.ts`, `lib/contentScore.ts`, `lib/optimizeSectionEdit.ts`, `lib/aiTokenUsage.ts`, `lib/optimizeSectionEvents.ts`).

**Spec:** `docs/superpowers/specs/2026-07-01-planner-optimize-design.md` (v2 — tech-lead review incorporated)
**Depends on:** A (merged) + B (`buildArticleContext`) + C (`buildGuidelines`). This branch is stacked on C; it merges cleanly once C lands.

## Global Constraints

- **NO new LLM call anywhere in the planner.** Routing/skip/budget decisions are deterministic transforms of C's already-computed `Guideline[]` + per-section signals (heading/body token overlap, `countOccurrences`, `missingPoints`, `guideline.sectionId`). D's defining constraint.
- **`buildOptimizationPlan` is a PURE function** — deterministic, no I/O, no DB, no `fetch`. The endpoint gathers inputs (`buildArticleContext`, `getOrgUsage5h`, local `computeContentScoreBreakdown`) and calls it. Same for `assignGuidelinesToSections`, `buildStepPrompt`, `estimateStepTokens`.
- **Server-side context only.** The endpoint derives planner inputs from `buildArticleContext(articleId)`; NEVER trust client-sent coverage/keyword/brand. `content` (live editor HTML) and `scoreData` from the body stay only as the no-`articleId` legacy fallback.
- **Planner consumes `Guideline`, not `CoverageItem`.** Do not re-derive coverage; do not import `checkCoverage`/`deepseekJudge`.
- **Named tunable constants** for every weight/threshold: `W_HEADING/W_BODY/W_FREQ/W_SECTION`, `MATCH_THRESHOLD`, `CONFIDENCE_NORM`, `DECAY`, `PROMPT_CONSTANT`, `TOKENS_PER_WORD`, `IMPORTANCE_WEIGHT`. No magic numbers inline.
- **Preserve the reused machinery byte-for-byte:** the retry loop, abort handling, `stripFences`/`isUsableEdit`/`normalizeHtmlForDiff` diffing, `buildSectionEvent` SSE. The `focus:'skip'` short-circuit emits `changed:false` with ZERO LLM calls and ZERO tokens.
- No new TypeScript `any` (`[[avoid-any-type]]`). Commit each task immediately (`[[concurrent-claude-sessions-hazard]]`).
- **Test isolation:** the pure modules import only A/B/C pure code + `lib/contentScore`/`lib/articleSections` (no DB) — no jest mock needed. The **endpoint test** transitively pulls in `database/database`, `buildArticleContext`, `getOrgUsage5h`, and `fetch` -> use LOCAL `jest.mock(...)` (mirror the existing `__tests__/api/articles-optimize-sections-guard.test.ts`); NEVER touch `jest.config.js`/`jest.setup.js`/`__mocks__/`.
- **Verify gates:** each code task ends `npx tsc --noEmit` clean + its jest suite. **Implementers must NOT run `npm run build`** (it hangs subagents — verified during A/B/C); the controller runs the full build once at the end. Pre-existing flaky `__tests__/pages/domains.test.tsx` is NOT ours.

## Assumptions (from the spec's ratified decisions)

1. Outline is OUT of D (separate "Outline Engine" sub-project — needs a new LLM call). 2. Planner consumes `Guideline[]` (not `CoverageItem[]`). 3. Server-side context via `buildArticleContext`. 4. Stateless per run; no cross-run section memory. 5. `ArticleContext.breakdown` stays null-typed (B frozen) — D computes `computeContentScoreBreakdown` locally in the endpoint. 6. No-`articleId` drafts fall back to `legacyPlanFromMissingTerms` (today's single global prompt).

---

## File Structure

**Create:** `lib/optimizeGuidelineRouting.ts`; `lib/optimizationPlanner.ts`; `__tests__/lib/optimizeGuidelineRouting.test.ts`, `__tests__/lib/optimizationPlanner.test.ts`.
**Modify:** `pages/api/articles/optimize-sections.ts`; extend `__tests__/api/articles-optimize-sections-guard.test.ts`.
**Untouched:** `lib/aiCoverage.ts`, `lib/recommendationEngine.ts`, `lib/articleContext.ts` (frozen); the loop dispatcher/retries/abort/SSE machinery; review-doc / Accept-Reject / TipTap atom.

---

## Task 1: routing scoring core — `assignGuidelinesToSections` matchScore + confidence + reason

**Files:** Create `lib/optimizeGuidelineRouting.ts`; Test `__tests__/lib/optimizeGuidelineRouting.test.ts`

**Interfaces:**
- Consumes: `Guideline` (`lib/recommendationEngine.ts`, C); `Section` (`lib/articleSections.ts`); `countOccurrences` (`lib/contentScore.ts`); `Importance` (`lib/aiCoverage.ts`).
- Produces: `RoutedGuideline { guideline; confidence; reason; priority }`; `assignGuidelinesToSections(guidelines, sections, opts): Map<string, RoutedGuideline[]>`. Task 1 ships the scoring path (exact sectionId + heading/body/frequency); Task 2 adds fallback + priority-sort + edge tests.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/lib/optimizeGuidelineRouting.test.ts
import { assignGuidelinesToSections } from '../../lib/optimizeGuidelineRouting';
import type { Guideline } from '../../lib/recommendationEngine';
import type { Section } from '../../lib/articleSections';

const g = (over: Partial<Guideline>): Guideline => ({
  id: 'guideline-x', coverageItemId: 'x', group: 'knowledge', title: 'X', instruction: 'Do X.',
  importance: 'recommended', status: 'open', projectedLift: 10, effort: 'Easy', easyWin: false, ...over,
});
const sec = (id: string, index: number, headingText: string, html: string): Section => ({ id, index, headingText, html });
const noBreakdown = { slots: [], totalPossible: 0 };

describe('assignGuidelinesToSections (scoring)', () => {
  it('exact sectionId match wins with confidence 1 and reason Exact section match', () => {
    const s0 = sec('sec_0_a', 0, 'Intro', '<p>hello</p>');
    const s1 = sec('sec_1_b', 1, 'Dosage', '<h2>Dosage</h2><p>take two</p>');
    const gl = g({ title: 'Cover: Side effects', sectionId: 'sec_1_b' });
    const routed = assignGuidelinesToSections([gl], [s0, s1], { breakdown: noBreakdown });
    expect(routed.get('sec_1_b')?.[0].guideline.coverageItemId).toBe('x');
    expect(routed.get('sec_1_b')?.[0].confidence).toBe(1);
    expect(routed.get('sec_1_b')?.[0].reason).toBe('Exact section match');
    expect(routed.get('sec_0_a')).toBeUndefined();
  });

  it('routes by heading token overlap when no sectionId', () => {
    const s0 = sec('sec_0_a', 0, 'Installation Guide', '<h2>Installation Guide</h2><p>run npm</p>');
    const s1 = sec('sec_1_b', 1, 'Pricing Plans', '<h2>Pricing Plans</h2><p>cost</p>');
    const gl = g({ title: 'Cover: Installation steps', instruction: 'Explain installation.' });
    const routed = assignGuidelinesToSections([gl], [s0, s1], { breakdown: noBreakdown });
    expect(routed.get('sec_0_a')?.[0].guideline.coverageItemId).toBe('x');
    expect(routed.get('sec_0_a')?.[0].confidence).toBeGreaterThan(0);
    expect(routed.get('sec_0_a')?.[0].confidence).toBeLessThanOrEqual(1);
  });

  it('routes an entity guideline to the section where its term already appears (body frequency)', () => {
    const s0 = sec('sec_0_a', 0, 'Overview', '<p>general text with nothing special</p>');
    const s1 = sec('sec_1_b', 1, 'Details', '<p>React Hooks are great; React Hooks simplify state</p>');
    const gl = g({ title: 'Use the term: React Hooks', instruction: 'Work the term React Hooks in.' });
    const routed = assignGuidelinesToSections([gl], [s0, s1], { breakdown: noBreakdown });
    expect(routed.get('sec_1_b')?.[0].guideline.coverageItemId).toBe('x');
  });
});
```

- [ ] **Step 2: Run -> fail** — `npx jest __tests__/lib/optimizeGuidelineRouting.test.ts --ci` -> `Cannot find module`.

- [ ] **Step 3: Implement**

```ts
// lib/optimizeGuidelineRouting.ts
import type { Guideline } from './recommendationEngine';
import type { Section } from './articleSections';
import type { Importance } from './aiCoverage';
import { countOccurrences } from './contentScore';

export interface RoutedGuideline {
  guideline: Guideline;
  confidence: number;   // [0,1]
  reason: string;
  priority: number;
}

// Tunable routing weights — a single-constant edit re-tunes routing.
const W_HEADING = 1.0;
const W_BODY = 0.6;
const W_FREQ = 0.5;
const W_SECTION = 3.0;
const MATCH_THRESHOLD = 0.15;                          // below this, the guideline falls back (Task 2)
const CONFIDENCE_NORM = W_HEADING + W_BODY + W_FREQ;   // a strong non-sectionId match ~ confidence 1

const IMPORTANCE_WEIGHT: Record<Importance, number> = { critical: 3, recommended: 2, optional: 1 };
export const importanceWeight = (imp: Importance): number => IMPORTANCE_WEIGHT[imp];

/** Local, stem-free tokenizer — keep routing self-contained (do NOT reuse contentScore.tokenize, Polish-stem specific). */
function tokens(s: string): Set<string> {
  return new Set((s.toLowerCase().match(/[a-z0-9]+/g) || []).filter((t) => t.length > 2));
}
function plainText(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
}
/** Overlap coefficient: intersection / min(size). 0 when either side empty. */
function overlap(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let hits = 0;
  for (const t of a) if (b.has(t)) hits += 1;
  return hits / Math.min(a.size, b.size);
}

/** The distinctive term of a guideline — its title minus the C prefix ("Cover:", "Use the term:", ...). */
function keyTerm(g: Guideline): string {
  return g.title.replace(/^(Cover|Expand|Use the term|Add):\s*/i, '').trim() || g.title;
}

interface Scored { section: Section; score: number; reason: string; }

function scoreSection(g: Guideline, section: Section, maxFreq: number): Scored {
  if (g.sectionId && g.sectionId === section.id) {
    return { section, score: W_SECTION, reason: 'Exact section match' };
  }
  const gTokens = tokens(`${g.title} ${g.instruction}`);
  const headingSim = overlap(gTokens, tokens(section.headingText));
  const body = plainText(section.html);
  const bodySim = overlap(gTokens, tokens(body));
  const term = keyTerm(g);
  const freq = maxFreq > 0 ? countOccurrences(body, term) / maxFreq : 0;
  const score = W_HEADING * headingSim + W_BODY * bodySim + W_FREQ * freq;
  const reason = headingSim >= bodySim && headingSim > 0
    ? `Heading overlap ${headingSim.toFixed(2)}`
    : (freq > 0 ? `Matched term ${term}` : 'Body-term match');
  return { section, score, reason };
}

export interface RouteOpts { breakdown: { slots: Array<{ key: string; missingPoints: number }>; totalPossible: number }; }

export function assignGuidelinesToSections(
  guidelines: Guideline[], sections: Section[], opts: RouteOpts,
): Map<string, RoutedGuideline[]> {
  const out = new Map<string, RoutedGuideline[]>();
  const push = (sectionId: string, rg: RoutedGuideline) => {
    const arr = out.get(sectionId) ?? [];
    arr.push(rg);
    out.set(sectionId, arr);
  };
  for (const guideline of guidelines) {
    const term = keyTerm(guideline);
    const maxFreq = Math.max(1, ...sections.map((s) => countOccurrences(plainText(s.html), term)));
    const scored = sections.map((s) => scoreSection(guideline, s, maxFreq)).sort((a, b) => b.score - a.score);
    const best = scored[0];
    if (!best || best.score < MATCH_THRESHOLD) continue; // Task 2 wires the fallback here
    const confidence = best.reason === 'Exact section match' ? 1 : Math.min(1, best.score / CONFIDENCE_NORM);
    const priority = importanceWeight(guideline.importance) * guideline.projectedLift * confidence;
    push(best.section.id, { guideline, confidence, reason: best.reason, priority });
  }
  return out;
}
```

- [ ] **Step 4: Run -> pass** (3 tests). **Step 5: Typecheck + commit**

```bash
npx tsc --noEmit
git add lib/optimizeGuidelineRouting.ts __tests__/lib/optimizeGuidelineRouting.test.ts
git commit -m "feat(planner): assignGuidelinesToSections scoring core — matchScore + confidence + reason (pure, no LLM)"
```

---

## Task 2: routing fallback + priority-sort + stale-sectionId / heading-miss edge cases

**Files:** Modify `lib/optimizeGuidelineRouting.ts`; append to `__tests__/lib/optimizeGuidelineRouting.test.ts`

**Interfaces:**
- Consumes: same as Task 1, plus `opts.breakdown.slots[].missingPoints` for the fallback and the section index for intent->intro.
- Produces: below-threshold guidelines routed via fallback (never dropped); each section array sorted by `priority` desc.

- [ ] **Step 1: Write the failing test (append)**

```ts
describe('assignGuidelinesToSections (fallback + priority + edges)', () => {
  const sec = (id: string, index: number, headingText: string, html: string): Section => ({ id, index, headingText, html });
  const g = (over: Partial<Guideline>): Guideline => ({
    id: 'guideline-x', coverageItemId: 'x', group: 'knowledge', title: 'X', instruction: 'Do X.',
    importance: 'recommended', status: 'open', projectedLift: 10, effort: 'Easy', easyWin: false, ...over,
  });

  it('stale sectionId (not among current sections) does NOT route to a missing section — falls through to scoring', () => {
    const s0 = sec('sec_0_a', 0, 'Installation', '<h2>Installation</h2><p>install steps here</p>');
    const gl = g({ title: 'Cover: Installation', instruction: 'installation', sectionId: 'sec_9_gone' });
    const routed = assignGuidelinesToSections([gl], [s0], { breakdown: { slots: [], totalPossible: 0 } });
    expect(routed.get('sec_9_gone')).toBeUndefined();
    expect(routed.get('sec_0_a')?.[0].guideline.coverageItemId).toBe('x'); // routed by heading, not lost
    expect(routed.get('sec_0_a')?.[0].reason).not.toBe('Exact section match');
  });

  it('heading-miss with no body/freq signal: intent guideline falls back to intro (index 0)', () => {
    const s0 = sec('sec_0_a', 0, '', '<p>opening paragraph</p>');
    const s1 = sec('sec_1_b', 1, 'Zzz Unrelated', '<h2>Zzz Unrelated</h2><p>qqq www</p>');
    const gl = g({ group: 'intent', title: 'Answer the main question early', instruction: 'answer early' });
    const routed = assignGuidelinesToSections([gl], [s0, s1], { breakdown: { slots: [], totalPossible: 0 } });
    expect(routed.get('sec_0_a')?.[0].guideline.coverageItemId).toBe('x');
    expect(routed.get('sec_0_a')?.[0].reason).toContain('Fallback');
  });

  it('heading-miss non-intent falls back to the highest-missingPoints section', () => {
    const s0 = sec('sec_0_a', 0, 'Alpha', '<h2>Alpha</h2><p>aaa</p>');
    const s1 = sec('sec_1_b', 1, 'Beta', '<h2>Beta</h2><p>bbb</p>');
    const gl = g({ title: 'Add statistic', instruction: 'cite a statistic', group: 'authority' });
    const breakdown = { slots: [{ key: 'sec_1_b', missingPoints: 9 }, { key: 'sec_0_a', missingPoints: 2 }], totalPossible: 100 };
    const routed = assignGuidelinesToSections([gl], [s0, s1], { breakdown });
    expect(routed.get('sec_1_b')?.[0].guideline.coverageItemId).toBe('x');
  });

  it('sorts each section array by priority desc (critical before higher-lift recommended)', () => {
    const s0 = sec('sec_0_a', 0, 'Dosage Guide', '<h2>Dosage Guide</h2><p>dosage details</p>');
    const crit = g({ coverageItemId: 'c', title: 'Cover: Dosage', instruction: 'dosage', importance: 'critical', projectedLift: 10 });
    const rec = g({ coverageItemId: 'r', title: 'Cover: Dosage', instruction: 'dosage', importance: 'recommended', projectedLift: 14 });
    const routed = assignGuidelinesToSections([rec, crit], [s0], { breakdown: { slots: [], totalPossible: 0 } });
    expect(routed.get('sec_0_a')?.map((r) => r.guideline.coverageItemId)).toEqual(['c', 'r']);
  });
});
```

- [ ] **Step 2: Run -> fail** — the stale-sectionId, both fallback, and priority-sort cases fail (Task 1 dropped below-threshold guidelines and did not sort).

- [ ] **Step 3: Implement** — replace the `continue` (Task 1) with a fallback, then priority-sort each array.

```ts
// lib/optimizeGuidelineRouting.ts — replace the loop tail + add a fallback helper.

/** Section for a below-threshold guideline: intent -> intro (index 0); else highest missingPoints. */
function fallbackSection(g: Guideline, sections: Section[], opts: RouteOpts): { section: Section; reason: string } | null {
  if (!sections.length) return null;
  if (g.group === 'intent') {
    const intro = sections.find((s) => s.index === 0) ?? sections[0];
    return { section: intro, reason: 'Fallback — intent to intro' };
  }
  const byMissing = [...sections].sort((a, b) => {
    const ma = opts.breakdown.slots.find((s) => s.key === b.id)?.missingPoints ?? 0;
    const mb = opts.breakdown.slots.find((s) => s.key === a.id)?.missingPoints ?? 0;
    return ma - mb;
  });
  return { section: byMissing[0], reason: 'Fallback — highest missingPoints' };
}

// ...inside assignGuidelinesToSections, replacing `if (!best || best.score < MATCH_THRESHOLD) continue;`:
    let target: Section;
    let confidence: number;
    let reason: string;
    if (best && best.score >= MATCH_THRESHOLD) {
      target = best.section;
      confidence = best.reason === 'Exact section match' ? 1 : Math.min(1, best.score / CONFIDENCE_NORM);
      reason = best.reason;
    } else {
      const fb = fallbackSection(guideline, sections, opts);
      if (!fb) continue;                       // no sections at all — nothing to route to
      target = fb.section;
      confidence = 0.1;                        // low — it is a guess
      reason = fb.reason;
    }
    const priority = importanceWeight(guideline.importance) * guideline.projectedLift * confidence;
    push(target.id, { guideline, confidence, reason, priority });
  }
  // Priority sort inside each section (drives prompt bullet order + step focus).
  for (const arr of out.values()) arr.sort((a, b) => b.priority - a.priority);
  return out;
}
```

- [ ] **Step 4: Run -> pass** (7 tests total in this suite). **Step 5: Typecheck + commit**

```bash
npx tsc --noEmit
git add lib/optimizeGuidelineRouting.ts __tests__/lib/optimizeGuidelineRouting.test.ts
git commit -m "feat(planner): routing fallback (intent->intro / highest-missingPoints) + priority sort + stale-sectionId guard"
```

---

## Task 3: pure primitives — `estimateStepTokens`, `diminishingLift`, plainText/wordCount

**Files:** Create `lib/optimizationPlanner.ts` (primitives + types only in this task); Test `__tests__/lib/optimizationPlanner.test.ts`

**Interfaces:**
- Consumes: `Section` (`lib/articleSections.ts`).
- Produces: `StepFocus`, `RoutedGuideline` (re-exported from routing), `PlanStep`, `Plan`, `PlanInput` types; `estimateStepTokens(section): number`; `diminishingLift(liftsDesc: number[]): number`; internal `plainText`/`wordCount`.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/lib/optimizationPlanner.test.ts
import { estimateStepTokens, diminishingLift } from '../../lib/optimizationPlanner';
import type { Section } from '../../lib/articleSections';

const sec = (html: string): Section => ({ id: 's', index: 0, headingText: '', html });

describe('estimateStepTokens', () => {
  it('counts words * 1.3 + PROMPT_CONSTANT(500), rounded', () => {
    const words = Array.from({ length: 220 }, (_, i) => `w${i}`).join(' ');
    expect(estimateStepTokens(sec(`<p>${words}</p>`))).toBe(Math.round(220 * 1.3 + 500)); // 786
  });
  it('a tiny section is never ~0 — still ~ PROMPT_CONSTANT', () => {
    expect(estimateStepTokens(sec('<p>hi</p>'))).toBeGreaterThanOrEqual(500);
  });
  it('strips tags before counting', () => {
    expect(estimateStepTokens(sec('<h2>One Two</h2><p>Three</p>'))).toBe(Math.round(3 * 1.3 + 500));
  });
});

describe('diminishingLift', () => {
  it('applies DECAY [1,0.7,0.5,0.3,0.2] and rounds (18,15,12 -> 35, not 45)', () => {
    expect(diminishingLift([18, 15, 12])).toBe(35);
  });
  it('single lift is unchanged', () => {
    expect(diminishingLift([18])).toBe(18);
  });
  it('6th+ guideline uses the 0.1 floor', () => {
    expect(diminishingLift([10, 10, 10, 10, 10, 10])).toBe(Math.round(10 + 7 + 5 + 3 + 2 + 1)); // 28
  });
  it('empty -> 0', () => expect(diminishingLift([])).toBe(0));
});
```

- [ ] **Step 2: Run -> fail** — `Cannot find module`.

- [ ] **Step 3: Implement** the types + primitives (routing logic arrives in Task 4).

```ts
// lib/optimizationPlanner.ts
import type { Section } from './articleSections';
import type { Guideline } from './recommendationEngine';
import type { ArticleContext } from './articleContext';
import type { computeContentScoreBreakdown } from './contentScore';
import type { RoutedGuideline } from './optimizeGuidelineRouting';

export type { RoutedGuideline } from './optimizeGuidelineRouting';
type ContentScoreBreakdown = ReturnType<typeof computeContentScoreBreakdown>;

export type StepFocus = 'seo-terms' | 'ai-coverage' | 'readability' | 'expand' | 'skip';

export interface PlanStep {
  sectionId: string;
  index: number;
  headingText: string;
  html: string;
  focus: StepFocus;
  systemPrompt: string;
  guidelines: RoutedGuideline[];
  missingTerms: string[];
  estimatedTokens: number;
  expectedLift: number;
  reason: string;
}

export interface Plan {
  steps: PlanStep[];
  estimatedTokens: number;
  trimmed: boolean;
  ignoredLift: number;
  rationale: string;
}

export interface PlanInput {
  sections: Section[];
  guidelines: Guideline[];
  breakdown: ContentScoreBreakdown;
  context: ArticleContext;
  budgetRemaining: number;
}

const PROMPT_CONSTANT = 500;   // system-prompt + user-wrapper overhead (~400-600)
const TOKENS_PER_WORD = 1.3;
const DECAY = [1, 0.7, 0.5, 0.3, 0.2] as const;   // floor 0.1 beyond the array
const decayAt = (i: number): number => (i < DECAY.length ? DECAY[i] : 0.1);

export function plainText(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
}
export function wordCount(plain: string): number {
  return plain.split(/\s+/).filter(Boolean).length;
}

/** Body words * 1.3 + fixed prompt overhead (NOT html.length/4). */
export function estimateStepTokens(section: Section): number {
  return Math.round(wordCount(plainText(section.html)) * TOKENS_PER_WORD + PROMPT_CONSTANT);
}

/** Diminishing-returns aggregate: lifts sorted desc, each * DECAY[i], rounded. */
export function diminishingLift(liftsDesc: number[]): number {
  const sorted = [...liftsDesc].sort((a, b) => b - a);
  return Math.round(sorted.reduce((sum, lift, i) => sum + lift * decayAt(i), 0));
}
```

- [ ] **Step 4: Run -> pass** (7 tests). **Step 5: Typecheck + commit**

```bash
npx tsc --noEmit
git add lib/optimizationPlanner.ts __tests__/lib/optimizationPlanner.test.ts
git commit -m "feat(planner): Plan types + estimateStepTokens (words*1.3+overhead) + diminishingLift (DECAY)"
```

---

## Task 4: `buildOptimizationPlan` — focus routing, skip decision, expectedLift

**Files:** Modify `lib/optimizationPlanner.ts`; append to `__tests__/lib/optimizationPlanner.test.ts`

**Interfaces:**
- Consumes: `assignGuidelinesToSections` (Task 1/2); `countOccurrences` (`lib/contentScore.ts`); `estimateStepTokens`/`diminishingLift` (Task 3); `buildStepPrompt` (stubbed here, filled in Task 6).
- Produces: `buildOptimizationPlan(input: PlanInput): Plan` — one step per section, focus assigned, skip short-circuit, `expectedLift` via diminishing returns. (ROI trim is Task 5.)

- [ ] **Step 1: Write the failing test (append)**

```ts
import { buildOptimizationPlan } from '../../lib/optimizationPlanner';
import type { PlanInput } from '../../lib/optimizationPlanner';
import type { Guideline } from '../../lib/recommendationEngine';
import type { ArticleContext } from '../../lib/articleContext';

const gl = (over: Partial<Guideline>): Guideline => ({
  id: 'guideline-x', coverageItemId: 'x', group: 'knowledge', title: 'X', instruction: 'Do X.',
  importance: 'recommended', status: 'open', projectedLift: 10, effort: 'Easy', easyWin: false, ...over,
});
const ctx = (over: Partial<ArticleContext> = {}): ArticleContext => ({
  articleId: 1, keyword: 'k', scoreData: null, breakdown: null, coverage: null,
  paa: [], terms: [], competitors: [], ...over,
} as ArticleContext);
const input = (over: Partial<PlanInput>): PlanInput => ({
  sections: [], guidelines: [], breakdown: { slots: [], totalPossible: 0 },
  context: ctx(), budgetRemaining: 1_000_000, ...over,
});

describe('buildOptimizationPlan focus + skip', () => {
  it('skip when nothing routed, no under-target terms, small missingPoints', () => {
    const sections = [{ id: 's0', index: 0, headingText: 'Covered', html: '<h2>Covered</h2><p>full</p>' }];
    const plan = buildOptimizationPlan(input({ sections }));
    expect(plan.steps[0].focus).toBe('skip');
    expect(plan.steps[0].estimatedTokens).toBe(0);
    expect(plan.steps[0].expectedLift).toBe(0);
    expect(plan.steps[0].reason).toBe('Skipped — no uncovered guidelines');
  });

  it('intent guideline -> ai-coverage focus', () => {
    const sections = [{ id: 's0', index: 0, headingText: '', html: '<p>opening</p>' }];
    const g = gl({ group: 'intent', title: 'Answer the main question early', sectionId: 's0' });
    const plan = buildOptimizationPlan(input({ sections, guidelines: [g] }));
    expect(plan.steps[0].focus).toBe('ai-coverage');
  });

  it('needsExpansion (effort Large) -> expand focus', () => {
    const sections = [{ id: 's0', index: 0, headingText: 'Shallow', html: '<h2>Shallow</h2><p>thin</p>' }];
    const g = gl({ effort: 'Large', title: 'Expand: Shallow', instruction: 'shallow', sectionId: 's0' });
    const plan = buildOptimizationPlan(input({ sections, guidelines: [g] }));
    expect(plan.steps[0].focus).toBe('expand');
  });

  it('expectedLift uses diminishing returns (18,15,12 -> 35)', () => {
    const sections = [{ id: 's0', index: 0, headingText: 'Dosage', html: '<h2>Dosage</h2><p>dosage</p>' }];
    const gs = [18, 15, 12].map((lift, i) =>
      gl({ coverageItemId: `g${i}`, title: 'Cover: Dosage', instruction: 'dosage', projectedLift: lift, sectionId: 's0' }));
    const plan = buildOptimizationPlan(input({ sections, guidelines: gs }));
    expect(plan.steps[0].expectedLift).toBe(35);
  });
});
```

- [ ] **Step 2: Run -> fail** — `buildOptimizationPlan is not a function`.

- [ ] **Step 3: Implement** `buildOptimizationPlan` (no trim yet — Task 5) with a temporary `buildStepPrompt` stub (real one in Task 6).

```ts
// lib/optimizationPlanner.ts — add imports + the planner. buildStepPrompt is filled in Task 6.
import { assignGuidelinesToSections } from './optimizeGuidelineRouting';
import { countOccurrences } from './contentScore';

const SMALL_MISSING_POINTS = 2;   // a section under this missingPoints with nothing routed is "covered enough"

/** Per-section under-target NLP terms (per-section countOccurrences, mirrors optimizeSectionEdit.computeMissingTerms). */
function sectionMissingTerms(secText: string, ctx: ArticleContext): string[] {
  const terms = ctx.scoreData?.terms ?? [];
  return terms
    .filter((t) => countOccurrences(secText, t.term) < Math.max(1, Math.round(t.target_count * 0.7)))
    .map((t) => t.term);
}

function focusFor(rgs: RoutedGuideline[], secTerms: string[]): StepFocus {
  const top = rgs[0]?.guideline;
  if (top?.group === 'intent') return 'ai-coverage';
  if (top?.effort === 'Large') return 'expand';                        // needsExpansion -> Large (effortOf)
  if (top && (top.group === 'knowledge' || top.group === 'authority')) return 'ai-coverage';
  if (secTerms.length > 0) return 'seo-terms';
  return 'readability';
}

export function buildOptimizationPlan(input: PlanInput): Plan {
  const routed = assignGuidelinesToSections(input.guidelines, input.sections, { breakdown: input.breakdown });

  const steps: PlanStep[] = input.sections.map((section) => {
    const rgs = routed.get(section.id) ?? [];
    const secText = plainText(section.html);
    const secTerms = sectionMissingTerms(secText, input.context);
    const missPts = input.breakdown.slots.find((s) => s.key === section.id)?.missingPoints ?? 0;

    const base = { sectionId: section.id, index: section.index, headingText: section.headingText, html: section.html, guidelines: rgs, missingTerms: secTerms };

    if (rgs.length === 0 && secTerms.length === 0 && missPts <= SMALL_MISSING_POINTS) {
      return { ...base, focus: 'skip', systemPrompt: '', estimatedTokens: 0, expectedLift: 0, reason: 'Skipped — no uncovered guidelines' };
    }
    const focus = focusFor(rgs, secTerms);
    const expectedLift = diminishingLift(rgs.map((r) => r.guideline.projectedLift));
    const step: PlanStep = {
      ...base, focus, expectedLift,
      estimatedTokens: estimateStepTokens(section),
      systemPrompt: buildStepPrompt({ ...base, focus, expectedLift, estimatedTokens: 0, reason: '', systemPrompt: '' }, input.context),
      reason: rgs.length ? `Optimize: ${rgs.length} guidelines` : 'Optimize: under-target terms',
    };
    return step;
  });

  const nonSkip = steps.filter((s) => s.focus !== 'skip');
  const rationale = `${nonSkip.length}/${steps.length} sections to optimize`;
  return { steps, estimatedTokens: nonSkip.reduce((sum, s) => sum + s.estimatedTokens, 0), trimmed: false, ignoredLift: 0, rationale };
}

// Temporary stub — replaced by the real per-focus builder in Task 6.
function buildStepPrompt(_step: PlanStep, _context: ArticleContext): string { return 'STUB'; }
```

- [ ] **Step 4: Run -> pass** (11 tests). **Step 5: Typecheck + commit**

```bash
npx tsc --noEmit
git add lib/optimizationPlanner.ts __tests__/lib/optimizationPlanner.test.ts
git commit -m "feat(planner): buildOptimizationPlan — focus routing + skip short-circuit + diminishing expectedLift (pure)"
```

---

## Task 5: ROI budget trim — `trimmed` / `ignoredLift`

**Files:** Modify `lib/optimizationPlanner.ts`; append to `__tests__/lib/optimizationPlanner.test.ts`

**Interfaces:**
- Consumes: the `steps` + `budgetRemaining` from Task 4.
- Produces: when total non-skip `estimatedTokens > budgetRemaining`, rank by `roi = expectedLift / max(estimatedTokens,1)`, keep greedily what fits, demote the rest to `skip` (reason "Trimmed — budget"), set `Plan.trimmed` + accumulate `Plan.ignoredLift`.

- [ ] **Step 1: Write the failing test (append)**

```ts
describe('buildOptimizationPlan ROI trim', () => {
  const two = () => {
    const sections = [
      { id: 'cheap', index: 0, headingText: 'Cheap', html: '<h2>Cheap</h2><p>cheap term here</p>' },
      { id: 'pricey', index: 1, headingText: 'Pricey', html: `<h2>Pricey</h2><p>${'w '.repeat(600)}</p>` },
    ];
    const guidelines = [
      gl({ coverageItemId: 'a', title: 'Cover: Cheap', instruction: 'cheap', projectedLift: 12, sectionId: 'cheap' }),
      gl({ coverageItemId: 'b', title: 'Cover: Pricey', instruction: 'pricey', projectedLift: 18, sectionId: 'pricey' }),
    ];
    return { sections, guidelines };
  };

  it('keeps the high-ROI cheap step and trims the expensive one when budget is tight', () => {
    const { sections, guidelines } = two();
    const plan = buildOptimizationPlan(input({ sections, guidelines, budgetRemaining: 900 }));
    const cheap = plan.steps.find((s) => s.sectionId === 'cheap')!;
    const pricey = plan.steps.find((s) => s.sectionId === 'pricey')!;
    expect(cheap.focus).not.toBe('skip');            // +12 @ ~small tokens — high roi, kept
    expect(pricey.focus).toBe('skip');               // +18 @ ~1280 tokens — low roi, trimmed
    expect(pricey.reason).toBe('Trimmed — budget');
    expect(plan.trimmed).toBe(true);
    expect(plan.ignoredLift).toBe(18);
  });

  it('no trim when budget is ample', () => {
    const { sections, guidelines } = two();
    const plan = buildOptimizationPlan(input({ sections, guidelines, budgetRemaining: 1_000_000 }));
    expect(plan.trimmed).toBe(false);
    expect(plan.ignoredLift).toBe(0);
    expect(plan.steps.every((s) => s.focus !== 'skip')).toBe(true);
  });
});
```

- [ ] **Step 2: Run -> fail** — trim path not implemented; `trimmed` is always false.

- [ ] **Step 3: Implement** — extract a `trimToBudget(steps, budget)` and call it before returning.

```ts
// lib/optimizationPlanner.ts — add, and call from buildOptimizationPlan before building the return object.

function trimToBudget(steps: PlanStep[], budgetRemaining: number): { trimmed: boolean; ignoredLift: number } {
  const nonSkip = steps.filter((s) => s.focus !== 'skip');
  const total = nonSkip.reduce((sum, s) => sum + s.estimatedTokens, 0);
  if (total <= budgetRemaining) return { trimmed: false, ignoredLift: 0 };

  const ranked = [...nonSkip].sort((a, b) =>
    (b.expectedLift / Math.max(b.estimatedTokens, 1)) - (a.expectedLift / Math.max(a.estimatedTokens, 1)));
  const keep = new Set<string>();
  let running = 0;
  for (const s of ranked) {
    if (running + s.estimatedTokens <= budgetRemaining) { keep.add(s.sectionId); running += s.estimatedTokens; }
  }
  let ignoredLift = 0;
  for (const s of steps) {
    if (s.focus !== 'skip' && !keep.has(s.sectionId)) {
      ignoredLift += s.expectedLift;
      s.focus = 'skip'; s.systemPrompt = ''; s.estimatedTokens = 0; s.reason = 'Trimmed — budget';
    }
  }
  return { trimmed: true, ignoredLift };
}

// ...in buildOptimizationPlan, replace the return with:
  const { trimmed, ignoredLift } = trimToBudget(steps, input.budgetRemaining);
  const survivingNonSkip = steps.filter((s) => s.focus !== 'skip');
  const rationale = `${survivingNonSkip.length}/${steps.length} sections to optimize${trimmed ? ` (trimmed, ignored ${ignoredLift} lift)` : ''}`;
  return {
    steps,
    estimatedTokens: survivingNonSkip.reduce((sum, s) => sum + s.estimatedTokens, 0),
    trimmed, ignoredLift, rationale,
  };
```

Note: `trimToBudget` mutates the demoted steps in place (they were just constructed in this call — no external aliasing), keeping `buildOptimizationPlan` referentially pure w.r.t. its inputs.

- [ ] **Step 4: Run -> pass** (13 tests). **Step 5: Typecheck + commit**

```bash
npx tsc --noEmit
git add lib/optimizationPlanner.ts __tests__/lib/optimizationPlanner.test.ts
git commit -m "feat(planner): ROI budget trim — keep high roi=lift/tokens, demote rest to skip, set trimmed/ignoredLift"
```

---

## Task 6: `buildStepPrompt` — shared + focus blocks + priority bullets + NEGATIVE CONSTRAINTS + brand voice

**Files:** Modify `lib/optimizationPlanner.ts` (replace the Task 4 stub); append to `__tests__/lib/optimizationPlanner.test.ts`

**Interfaces:**
- Consumes: `PlanStep` (focus, priority-sorted `guidelines`, `missingTerms`), `ArticleContext` (`voiceTone`).
- Produces: the per-section system prompt (replaces the global `buildSystemPrompt`), including a NEGATIVE CONSTRAINTS block; `''` when focus is skip.

- [ ] **Step 1: Write the failing test (append)**

```ts
import { buildStepPrompt } from '../../lib/optimizationPlanner';
import type { PlanStep } from '../../lib/optimizationPlanner';

const step = (over: Partial<PlanStep>): PlanStep => ({
  sectionId: 's', index: 0, headingText: 'H', html: '<p>x</p>', focus: 'seo-terms',
  systemPrompt: '', guidelines: [], missingTerms: [], estimatedTokens: 0, expectedLift: 0, reason: '', ...over,
});
const rg = (title: string, instruction: string, priority: number) => ({
  guideline: gl({ title, instruction }), confidence: 1, reason: 'r', priority,
});

describe('buildStepPrompt', () => {
  it('skip -> empty string', () => {
    expect(buildStepPrompt(step({ focus: 'skip' }), ctx())).toBe('');
  });
  it('always includes the NEGATIVE CONSTRAINTS block', () => {
    const p = buildStepPrompt(step({ focus: 'readability' }), ctx());
    expect(p).toContain('Do NOT');
    expect(p.toLowerCase()).toContain('other sections');
  });
  it('seo-terms weaves per-section missingTerms verbatim (not article-wide)', () => {
    const p = buildStepPrompt(step({ focus: 'seo-terms', missingTerms: ['react hooks', 'useEffect'] }), ctx());
    expect(p).toContain('"react hooks"');
    expect(p).toContain('"useEffect"');
  });
  it('ai-coverage renders guideline bullets in priority order', () => {
    const p = buildStepPrompt(step({
      focus: 'ai-coverage',
      guidelines: [rg('Cover: A', 'Add A.', 30), rg('Cover: B', 'Add B.', 10)],
    }), ctx());
    expect(p.indexOf('Add A.')).toBeLessThan(p.indexOf('Add B.'));
  });
  it('appends brand voice when context.voiceTone present, omits when absent', () => {
    const withVoice = buildStepPrompt(step({ focus: 'expand' }), ctx({ voiceTone: 'confident, concise' }));
    expect(withVoice).toContain('confident, concise');
    expect(buildStepPrompt(step({ focus: 'expand' }), ctx())).not.toContain('brand voice');
  });
});
```

- [ ] **Step 2: Run -> fail** — the stub returns `'STUB'`.

- [ ] **Step 3: Implement** — replace the stub. Export `buildStepPrompt`; keep the existing minimal-surgical rules verbatim.

```ts
// lib/optimizationPlanner.ts — replace the temporary stub with the real builder.

const SHARED_RULES = `You are an expert SEO content editor making MINIMAL, surgical edits to ONE section of an HTML article.

RULES:
- Apply MINIMAL surgical edits — refine, do not rewrite
- Tighten weak sentences and remove AI-sounding filler ("It's worth noting that", "In today's world", "Furthermore", "In conclusion", "Delve into")
- Keep the SAME LANGUAGE as the input (auto-detect — do NOT translate)
- Preserve EVERY heading, <a> link, <img>, and list EXACTLY as written
- Do NOT remove or shorten existing sentences — only refine or expand
- Keep each paragraph between ~40 and ~80 words`;

const NEGATIVE_CONSTRAINTS = `NEGATIVE CONSTRAINTS — Do NOT: rewrite unrelated paragraphs, remove or alter existing links, remove tables/images/lists, duplicate or rename headings, touch other sections, translate the text, or add markdown code fences.`;

const OUTPUT_RULE = `OUTPUT: ONLY the section's raw HTML. No markdown code fences, no commentary.`;

function focusBlock(step: PlanStep): string {
  const bullets = step.guidelines.map((r) => `- ${r.guideline.title}: ${r.guideline.instruction}`).join('\n');
  switch (step.focus) {
    case 'seo-terms': {
      const list = step.missingTerms.map((t) => `"${t}"`).join(', ');
      return list ? `FOCUS — weave in these MISSING NLP terms VERBATIM where natural (exact form, no inflection/synonyms): ${list}` : '';
    }
    case 'ai-coverage':
      return `FOCUS — improve AI-search answer readiness. Apply these guidelines:\n${bullets}`;
    case 'expand':
      return `FOCUS — deepen this section; it is currently shallow. Apply:\n${bullets}`;
    case 'readability':
      return `FOCUS — improve readability only: tighten sentences, de-fluff, right-size paragraphs.`;
    default:
      return '';
  }
}

export function buildStepPrompt(step: PlanStep, context: ArticleContext): string {
  if (step.focus === 'skip') return '';
  const brand = context.voiceTone ? `\n\nMatch this brand voice: ${context.voiceTone}` : '';
  const block = focusBlock(step);
  return `${SHARED_RULES}\n\n${block}${brand}\n\n${NEGATIVE_CONSTRAINTS}\n\n${OUTPUT_RULE}`;
}
```

Then in `buildOptimizationPlan`, call the real builder with the fully-formed step (the Task 4 call already passes the step + context; ensure it passes the final `focus`/`guidelines`/`missingTerms`).

- [ ] **Step 4: Run -> pass** (18 tests). **Step 5: Typecheck + commit**

```bash
npx tsc --noEmit
git add lib/optimizationPlanner.ts __tests__/lib/optimizationPlanner.test.ts
git commit -m "feat(planner): buildStepPrompt — per-focus block + priority bullets + brand voice + NEGATIVE CONSTRAINTS"
```

---

## Task 7: endpoint wiring — server-side context, local breakdown, iterate `plan.steps`, per-step prompt

**Files:** Modify `pages/api/articles/optimize-sections.ts`

**Interfaces:**
- Consumes: `buildArticleContext` (B), `buildGuidelines` (C), `computeContentScoreBreakdown` (`lib/contentScore.ts`), `buildOptimizationPlan`/`plainText`/`wordCount` (this sub-project), `getOrgUsage5h`/`AI_TOKEN_LIMIT_5H` (already imported for the hard gate).
- Produces: the loop iterates `plan.steps`; each non-skip step uses `step.systemPrompt`; skip steps short-circuit to a `changed:false` SSE with no fetch. Token accounting `finally` is Task 8.

- [ ] **Step 1: Read the current endpoint** (`optimize-sections.ts:95-154`) — confirm the seam is between `splitSections` (`:96`, after the `meta` SSE) and the loop (`:106`). Note the counts `computeContentScoreBreakdown` needs (`wordCount`, `headingCount`, `paragraphCount`) are NOT computed here today — add small local helpers from `content`.

- [ ] **Step 2: Insert planner assembly** after the `meta` SSE (replaces `:100-101` `computeMissingTerms`/`buildSystemPrompt`).

```ts
// after: sse(res, 'meta', {...});
import { buildArticleContext } from '../../../lib/articleContext';
import { buildGuidelines } from '../../../lib/recommendationEngine';
import { computeContentScoreBreakdown } from '../../../lib/contentScore';
import { buildOptimizationPlan, plainText, wordCount } from '../../../lib/optimizationPlanner';
import { AI_TOKEN_LIMIT_5H } from '../../../lib/aiTokenUsage';

const ctx = articleId != null ? await buildArticleContext(Number(articleId)) : null;
const snapshot = ctx?.coverage ?? null;
const guidelines = snapshot ? buildGuidelines(snapshot, ctx ?? undefined) : [];

const plainAll = plainText(content);
const headingCount = (content.match(/<h[1-6][ >]/gi) || []).length;
const paragraphCount = (content.match(/<p[ >]/gi) || []).length;
const breakdown = ctx?.scoreData
  ? computeContentScoreBreakdown(plainAll, wordCount(plainAll), headingCount, ctx.scoreData, paragraphCount, content, ctx.keyword, undefined, snapshot?.items ? [...snapshot.items] : undefined)
  : { slots: [], totalPossible: 0 };

const usage = orgId != null ? await getOrgUsage5h(orgId) : { used: 0, limit: AI_TOKEN_LIMIT_5H, resetsAt: 0, over: false };

const plan = ctx
  ? buildOptimizationPlan({ sections, guidelines, breakdown, context: ctx, budgetRemaining: usage.limit - usage.used })
  : legacyPlan(sections, scoreData, content);

if (plan.trimmed) sse(res, 'meta', { trimmed: true, ignoredLift: plan.ignoredLift });
```

- [ ] **Step 3: Add the `legacyPlan` fallback** (no `articleId` — unsaved draft) reproducing today's single-global-prompt behavior, so drafts still optimize.

```ts
// module scope — one prompt for all sections, focus 'seo-terms', from the article-wide missing terms.
function legacyPlan(sections: Section[], scoreData: ScoreData | undefined, content: string): Plan {
  const terms = computeMissingTerms(scoreData, content);
  const sys = buildSystemPrompt(terms);
  const steps: PlanStep[] = sections.map((s) => ({
    sectionId: s.id, index: s.index, headingText: s.headingText, html: s.html,
    focus: 'seo-terms', systemPrompt: sys, guidelines: [], missingTerms: terms,
    estimatedTokens: 0, expectedLift: 0, reason: 'Legacy: no articleId',
  }));
  return { steps, estimatedTokens: 0, trimmed: false, ignoredLift: 0, rationale: 'legacy' };
}
```

- [ ] **Step 4: Rewrite the loop** — iterate `plan.steps`; skip short-circuits; per-step prompt. Keep the retry/abort/fetch/diff machinery byte-for-byte, changing ONLY `messages[0].content` to `step.systemPrompt` and the loop variable.

```ts
for (const step of plan.steps) {
  if (aborted) break;
  const section: Section = { id: step.sectionId, index: step.index, headingText: step.headingText, html: step.html };
  if (step.focus === 'skip') {
    sse(res, 'section', buildSectionEvent(section, { oldHtml: step.html, newHtml: step.html, changed: false }));
    continue;                                   // NO fetch, NO tokens
  }
  let newHtml = section.html;
  // ... EXISTING retry loop verbatim (:110-138), except messages[0] = { role: 'system', content: step.systemPrompt } ...
  const changed = normalizeHtmlForDiff(section.html) !== normalizeHtmlForDiff(newHtml);
  const result: SectionResult = { oldHtml: section.html, newHtml, changed };
  if (changed) changedCount += 1;
  sse(res, 'section', buildSectionEvent(section, result));
}
```

- [ ] **Step 5: Update `done`** to carry `total: plan.steps.length`, `trimmed: plan.trimmed`, `ignoredLift: plan.ignoredLift`. Remove the now-unused module-level `buildSystemPrompt`/`computeMissingTerms` ONLY if `legacyPlan` no longer references them (it does — keep them). Delete the old `const systemPrompt = buildSystemPrompt(...)` at `:101`.

- [ ] **Step 6: Verify** — `npx tsc --noEmit` clean. (Token accounting `finally` + endpoint tests are Task 8.)

- [ ] **Step 7: Commit**

```bash
git add pages/api/articles/optimize-sections.ts
git commit -m "feat(planner): wire buildOptimizationPlan into optimize-sections — server-side ctx, per-step prompt, skip short-circuit"
```

---

## Task 8: per-step token accounting in `finally` (B cubic-P1) + `trimmed`/skip SSE regression

**Files:** Modify `pages/api/articles/optimize-sections.ts`; extend `__tests__/api/articles-optimize-sections-guard.test.ts`

**Interfaces:**
- Consumes: the `aiTokens` accumulator + `shouldChargeCredit`/`recordAiTokens` (already imported).
- Produces: `recordAiTokens` runs in a `finally` so spend is recorded even on a mid-run throw (mirrors `deep-analysis.ts:566-571`); the skip short-circuit and `trimmed`/`ignoredLift` on `done`/`meta` are regression-locked.

- [ ] **Step 1: Write the failing test (extend the guard suite)** — LOCAL mocks of `buildArticleContext`, `getOrgUsage5h`/`recordAiTokens`, and `global.fetch`.

```ts
// __tests__/api/articles-optimize-sections-guard.test.ts (append)
jest.mock('../../lib/articleContext', () => ({
  buildArticleContext: jest.fn(async () => ({
    articleId: 1, keyword: 'k', scoreData: { terms: [], words_target: 0, words_min: 0, words_max: 0, headings_target: 0, headings_min: 0, headings_max: 0 },
    breakdown: null,
    coverage: { schemaVersion: 1, judgeVersion: 'v1', promptVersion: 'v1', model: 'm', createdAt: '', items: [], buckets: [], answersMainQuestionEarly: false, overall: 0 },
    paa: [], terms: [], competitors: [],
  })),
}));
const recordAiTokens = jest.fn(async () => {});
jest.mock('../../lib/aiTokenUsage', () => ({
  __esModule: true,
  AI_TOKEN_LIMIT_5H: 500000,
  getOrgUsage5h: jest.fn(async () => ({ used: 0, limit: 500000, resetsAt: 0, over: false })),
  recordAiTokens: (...a: unknown[]) => recordAiTokens(...a),
}));

it('skip step emits changed:false and makes NO fetch call', async () => {
  const fetchSpy = jest.spyOn(global, 'fetch');
  // content: one already-covered section, no guidelines, no terms -> planner returns focus:skip
  const events = await runHandler({ content: '<h2>Covered</h2><p>full and complete</p>', articleId: 1 });
  const sectionEvt = events.find((e) => e.event === 'section');
  expect(sectionEvt?.data.changed).toBe(false);
  expect(fetchSpy).not.toHaveBeenCalled();       // zero LLM calls for a skip
});

it('records tokens in finally even if a mid-run step throws', async () => {
  (global.fetch as jest.Mock) = jest.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ usage: { total_tokens: 200 }, choices: [{ message: { content: '<h2>A</h2><p>edited enough to be usable here</p>' } }] }) })
    .mockRejectedValue(new Error('boom'));       // second section throws all retries
  await runHandler({ content: '<h2>A</h2><p>aaa</p><h2>B</h2><p>bbb</p>', articleId: 1, guidelinesForce: true });
  expect(recordAiTokens).toHaveBeenCalled();      // finally recorded the 200 from section A
});

it('done event carries trimmed + ignoredLift', async () => {
  const events = await runHandler({ content: '<h2>A</h2><p>aaa</p>', articleId: 1 });
  const done = events.find((e) => e.event === 'done');
  expect(done?.data).toHaveProperty('trimmed');
  expect(done?.data).toHaveProperty('ignoredLift');
});
```

(`runHandler` is the suite's existing SSE-capturing harness; extend it to parse `event:`/`data:` frames if it does not already. Keep the pre-existing guard tests — the 429 hard-gate and access checks — unchanged and green.)

- [ ] **Step 2: Run -> fail** — `recordAiTokens` still runs only after the loop (skipped on throw); `done` lacks `trimmed`/`ignoredLift`.

- [ ] **Step 3: Implement** — wrap the loop in `try { ... } finally { ... }`.

```ts
let changedCount = 0;
let aiTokens = 0;
try {
  for (const step of plan.steps) { /* ... Task 7 loop ... */ }
} finally {
  // B cubic-P1: record spend even on mid-run throw (deep-analysis.ts:566-571).
  if (!aborted && orgId != null && shouldChargeCredit(changedCount, aiTokens)) {
    await recordAiTokens(orgId, aiTokens);
  }
}
if (aborted) return;
const creditDeducted = orgId != null && shouldChargeCredit(changedCount, aiTokens);
sse(res, 'done', { changedCount, total: plan.steps.length, promptVersion: PROMPT_VERSION, creditDeducted, trimmed: plan.trimmed, ignoredLift: plan.ignoredLift });
```

Note: `creditDeducted` is recomputed after the `finally` for the `done` payload; the actual `recordAiTokens` happens in the `finally`. Because `shouldChargeCredit` is deterministic on the same `changedCount`/`aiTokens`, the flag and the recorded spend cannot diverge.

- [ ] **Step 4: Run -> pass** (guard suite green, incl. the 3 new tests + all pre-existing). **Step 5: Typecheck + commit**

```bash
npx tsc --noEmit
git add pages/api/articles/optimize-sections.ts __tests__/api/articles-optimize-sections-guard.test.ts
git commit -m "feat(planner): per-step token accounting in finally (cubic-P1) + trimmed/ignoredLift SSE + skip regression"
```

---

## Final verification

- [ ] D suites green: `npx jest __tests__/lib/optimizeGuidelineRouting.test.ts __tests__/lib/optimizationPlanner.test.ts __tests__/api/articles-optimize-sections-guard.test.ts --ci`.
- [ ] Full suite: `npx jest --ci` — only the pre-existing flaky `domains.test.tsx` may fail.
- [ ] `npx tsc --noEmit` clean. `npm run build` OK (**controller only** — subagents must NOT run it). `graphify update .`.
- [ ] Whole-branch review (opus): NO new LLM call introduced (planner is a pure transform; the only `fetch` is the unchanged per-section edit); `buildOptimizationPlan`/`assignGuidelinesToSections`/`buildStepPrompt`/`estimateStepTokens` are PURE; routing scoring correct incl. stale-sectionId + heading-miss fallback; diminishing lift (18,15,12->35); ROI trim (+12/150 beats +18/1200); priority = importanceWeight*lift*confidence; per-section prompt has the NEGATIVE CONSTRAINTS block + per-section terms; skip = zero fetch + zero tokens + changed:false; `recordAiTokens` in `finally`; server-side context (no client-trusted coverage/brand); no new `any`; no global jest-infra change; the retry/abort/diff/SSE machinery byte-for-byte unchanged.

## Self-review (spec coverage — the 8 tech-lead changes)

- Change 1 (richer scoring routing + confidence + reason + swappable seam) -> Tasks 1-2. ✓
- Change 2 (diminishing-returns expectedLift, DECAY) -> Task 3 (`diminishingLift`) + Task 4 (applied per section). ✓
- Change 3 (ROI budget trim) -> Task 5. ✓
- Change 4 (observability: RoutedGuideline, PlanStep.reason, ignoredLift/trimmed) -> Tasks 1/4/5/8. ✓
- Change 5 (priority = importanceWeight*lift*confidence) -> Task 1 (computed) + Task 2 (sort). ✓
- Change 6 (estimateStepTokens = words*1.3 + PROMPT_CONSTANT) -> Task 3. ✓
- Change 7 (buildStepPrompt: shared + focus + priority bullets + NEGATIVE CONSTRAINTS + brand) -> Task 6. ✓
- Change 8 (keep pipeline separation, pure planner, per-section prompt, skip short-circuit — no regression) -> Global Constraints + Tasks 7-8. ✓
- Ratified: Outline OUT (Outline Engine separate); consumes Guideline[]; server-side context; stateless/no cross-run memory -> Assumptions + Tasks 4/7. ✓
- Out of scope (embeddings, fractional charging, DB columns, ArticleContext.breakdown wiring) -> no tasks. ✓
