# Auto-Optimize "Less" Mode (Sub-project F) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a real `worthEditing` "good enough" gate + a three-mode edit taxonomy (LESS / NORMAL / EXPAND) to the planner so Auto-Optimize does minimal "Less"-style patches instead of rewriting whole articles. NORMAL is byte-for-byte today's behaviour; LESS and EXPAND are new; the `expectedLift` value that D already computes becomes a first-class benefit THRESHOLD (not just ROI-trim). SEO + AI scores are threaded into `PlanInput` from the endpoint to drive the AI-search takeover rule.

**Architecture:** All new logic is PURE and ADDITIVE inside `lib/optimizationPlanner.ts` (`worthEditing`, `selectMode`, `introMayExpand`, `hasCriticalMiss`, `LESS_RULES`, `buildLessPrompt`, `buildStepPromptForMode`, `userInstructionForMode`, 6 named constants, `EditMode` + 2 new `PlanStep` fields + 2 new `PlanInput` fields). The endpoint (`pages/api/articles/optimize-sections.ts`) changes only two things: it reads `seoScore` + `aiScore` server-side and passes them into `buildOptimizationPlan`, and its per-section user message becomes `step.userInstruction ??` today's `Improve this section` literal.

**Tech Stack:** TypeScript, Next.js (pages), Jest. Reuses A (`lib/aiCoverage.ts`), B (`lib/articleContext.ts`), C (`lib/recommendationEngine.ts`), D (`lib/optimizationPlanner.ts`, `lib/optimizeGuidelineRouting.ts`, the endpoint), `lib/contentScore.ts`, `lib/aiSearchScore.ts`.

**Spec:** `docs/superpowers/specs/2026-07-01-auto-optimize-less-mode-design.md`
**Root-cause:** `docs/2026-07-01-auto-optimize-root-cause-report.md`
**Depends on:** D merged (planner + endpoint wiring). This branch is `feature/less-mode`.

## Global Constraints

- **NORMAL is byte-for-byte today's behaviour.** A section F classifies NORMAL MUST produce the exact `systemPrompt` from today's `buildStepPrompt` (`optimizationPlanner.ts:170-175`) AND `userInstruction === undefined` (so the endpoint uses `Improve this section:\n\n`+html verbatim, `optimize-sections.ts:165`). Task 7 is a dedicated regression that proves this.
- **NO new LLM call.** `worthEditing`/`selectMode`/`buildOptimizationPlan` stay PURE - deterministic transforms of `PlanInput`. `seoScore`/`aiScore` are INPUTS read in the endpoint, never fetched in the planner.
- **Named tunable constants** for every threshold: `LESS_MIN`, `NORMAL_MIN`, `SEO_HIGH`, `AI_GAP`, `INTENT_INTRO_MIN`, `TERM_WORTH_FLOOR`. No magic numbers inline.
- **Term-only sections → LESS** (OD-2 [RATIFIED]): a section with `rgs=[]` + `secTerms>0` has `expectedLift=0` but is WORTH a LESS (minimal) edit — `TERM_WORTH_FLOOR = 1` makes `worthEditing` return `true` when NOT in `aiTakeover`, and `selectMode` maps it to LESS. It is dropped ONLY under the AI-search takeover (the `!aiTakeover` guard). This reclassifies today's term-only NORMAL edit into a minimal LESS patch (SurferSEO's "Less" still weaves missing terms) — the intentional [RATIFIED] change flagged in the design.
- **Frozen (do NOT edit):** `lib/optimizeGuidelineRouting.ts`, `lib/recommendationEngine.ts`, `lib/aiCoverage.ts`, `lib/articleContext.ts`, `lib/contentScore.ts`, `lib/aiSearchScore.ts`, and the existing `buildStepPrompt`/`SHARED_RULES`/`NEGATIVE_CONSTRAINTS`/`OUTPUT_RULE`/`focusBlock` in `optimizationPlanner.ts` (REUSED unchanged by NORMAL/EXPAND).
- No new TypeScript `any` (`[[avoid-any-type]]`). Commit each task immediately (`[[concurrent-claude-sessions-hazard]]`).
- **Test isolation:** the pure planner tests import only A/B/C/D pure code (no DB) - no jest mock needed. The endpoint test transitively pulls DB + `fetch` -> use LOCAL `jest.mock(...)` (mirror `__tests__/api/articles-optimize-sections-guard.test.ts`); NEVER touch `jest.config.js`/`jest.setup.js`/`__mocks__/`.
- **Verify gates:** each code task ends `npx tsc --noEmit` clean + its jest suite. **Implementers must NOT run `npm run build`** (it hangs subagents); the controller runs the full build once at the end. Keep D's 26 tests (`__tests__/lib/optimizeGuidelineRouting.test.ts`, `__tests__/lib/optimizationPlanner.test.ts`) + the endpoint guard suite green.

---

## File Structure

**Modify:** `lib/optimizationPlanner.ts` (new types/constants/functions); `pages/api/articles/optimize-sections.ts` (score reads + user-message line + `buildSectionEvent` field forwarding + `legacyPlan` step shape); `lib/optimizeSectionEvents.ts` (optional `focus`/`mode`/`reason` on `buildSectionEvent`/`SectionEvent` — UX contract); `__tests__/lib/optimizationPlanner.test.ts` (new cases); `__tests__/api/articles-optimize-sections-guard.test.ts` (new cases).
**Untouched:** `lib/optimizeGuidelineRouting.ts`, `lib/recommendationEngine.ts`, `lib/aiCoverage.ts`, `lib/articleContext.ts`, `lib/contentScore.ts`, `lib/aiSearchScore.ts`; the loop dispatcher/retries/abort/SSE machinery; review-doc / Accept-Reject / TipTap atom.

---

## Task 1: Types + named constants

**Files:** Modify `lib/optimizationPlanner.ts`

**Interfaces:** add `EditMode`; add `mode`/`userInstruction` to `PlanStep`; add `seoScore`/`aiScore` to `PlanInput`; add the 6 tunable constants. Existing code compiles by defaulting every step to `mode: 'normal'`.

- [ ] **Step 1: Add types + constants**

```ts
// lib/optimizationPlanner.ts - near the top, after the existing imports

export type EditMode = 'less' | 'normal' | 'expand';

// --- F: benefit-threshold + takeover constants (tunable; 0..100 AI-score scale) ---
const LESS_MIN = 6;            // expectedLift < LESS_MIN -> skip
const NORMAL_MIN = 12;         // LESS_MIN..NORMAL_MIN -> LESS; > NORMAL_MIN -> NORMAL
const SEO_HIGH = 85;           // SEO score at/above which AI-takeover can fire
const AI_GAP = 25;             // takeover when (seoScore - aiScore) > AI_GAP
const INTENT_INTRO_MIN = 50;   // intent bucket score below which intro may expand
const TERM_WORTH_FLOOR = 1;    // OD-2 [RATIFIED]: a section with >=1 under-target term (when NOT in aiTakeover) is worth a LESS edit
```

Extend the existing interfaces (do NOT reorder existing fields):

```ts
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
  mode: EditMode;             // NEW
  userInstruction?: string;   // NEW - LESS patch-only user message; undefined -> endpoint uses today's literal
}

export interface PlanInput {
  sections: Section[];
  guidelines: Guideline[];
  context: ArticleContext;
  budgetRemaining: number;
  seoScore: number;           // NEW - computeContentScore result (contentScore.ts:386)
  aiScore: number;            // NEW - computeAiSearchScore result (aiSearchScore.ts:19)
}
```

- [ ] **Step 2:** Make existing code compile - every place that constructs a `PlanStep` literal must set `mode`. In `buildOptimizationPlan` the skip branch (`:92-93`) and the non-skip `step` object (`:97-102`) each get `mode: 'normal'` (temporary; Task 6 replaces the non-skip one with `selectMode`). The `trimToBudget` demote-to-skip mutation (`:130-133`) needs no `mode` change (it mutates an existing step). Update the two D test factories if they build `PlanStep` literals.

- [ ] **Step 3: Verify** - `npx tsc --noEmit` clean; `npx jest __tests__/lib/optimizationPlanner.test.ts --ci` still green (D behaviour unchanged - every step is NORMAL). Commit.

---

## Task 2: `hasCriticalMiss` + `worthEditing` (pure benefit gate)

**Files:** Modify `lib/optimizationPlanner.ts`; Test `__tests__/lib/optimizationPlanner.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/lib/optimizationPlanner.test.ts - add
import { worthEditing } from '../../lib/optimizationPlanner';
import type { RoutedGuideline } from '../../lib/optimizeGuidelineRouting';
import type { Guideline } from '../../lib/recommendationEngine';

const rg = (over: Partial<Guideline>): RoutedGuideline => ({
  guideline: {
    id: 'g', coverageItemId: 'c', group: 'knowledge', title: 'T', instruction: 'I',
    importance: 'recommended', status: 'open', projectedLift: 10, effort: 'Easy', easyWin: false, ...over,
  },
  confidence: 0.8, reason: 'r', priority: 1,
});

describe('worthEditing', () => {
  it('skips below LESS_MIN (expectedLift 5)', () => {
    expect(worthEditing({ expectedLift: 5, rgs: [rg({})], secTerms: [], aiTakeover: false })).toBe(false);
  });
  it('keeps at/above LESS_MIN (expectedLift 6)', () => {
    expect(worthEditing({ expectedLift: 6, rgs: [rg({})], secTerms: [], aiTakeover: false })).toBe(true);
  });
  it('term-only section (expectedLift 0, secTerms present) is worth a LESS edit (OD-2 [RATIFIED])', () => {
    expect(worthEditing({ expectedLift: 0, rgs: [], secTerms: ['foo', 'bar'], aiTakeover: false })).toBe(true);
  });
  it('term-only section under AI-takeover is dropped (takeover suppresses the term path)', () => {
    expect(worthEditing({ expectedLift: 0, rgs: [], secTerms: ['foo', 'bar'], aiTakeover: true })).toBe(false);
  });
  it('critical miss overrides the threshold (never skipped even at expectedLift 0)', () => {
    expect(worthEditing({ expectedLift: 0, rgs: [rg({ importance: 'critical' })], secTerms: [], aiTakeover: false })).toBe(true);
  });
});
```

- [ ] **Step 2: Run -> fail** - `npx jest __tests__/lib/optimizationPlanner.test.ts --ci` -> `worthEditing is not a function`.

- [ ] **Step 3: Implement**

```ts
// lib/optimizationPlanner.ts

export function hasCriticalMiss(rgs: RoutedGuideline[]): boolean {
  return rgs.some((r) => r.guideline.importance === 'critical');
}

interface WorthInput {
  expectedLift: number;
  rgs: RoutedGuideline[];
  secTerms: string[];
  aiTakeover: boolean;
}

/** The "good enough" gate (RCA §1/§5). Skip a section whose predicted benefit is below LESS_MIN,
 *  unless it carries a critical coverage miss. Term-only sections (expectedLift 0) are worth a LESS
 *  edit when NOT in AI-takeover (OD-2 [RATIFIED]); AI-takeover suppresses the term path. */
export function worthEditing({ expectedLift, rgs, secTerms, aiTakeover }: WorthInput): boolean {
  if (hasCriticalMiss(rgs)) return true;
  if (expectedLift >= LESS_MIN) return true;
  // Term-only deficit: >=1 under-target term is worth a minimal LESS weave, unless AI-takeover drops it.
  if (!aiTakeover && secTerms.length >= TERM_WORTH_FLOOR) return true;
  return false;
}
```

- [ ] **Step 4: Verify** - `npx tsc --noEmit` clean; the new suite passes. Commit.

---

## Task 3: `introMayExpand` + `selectMode` (tiers + intro guard + expand gate)

**Files:** Modify `lib/optimizationPlanner.ts`; Test `__tests__/lib/optimizationPlanner.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/lib/optimizationPlanner.test.ts - add
import { selectMode, introMayExpand } from '../../lib/optimizationPlanner';
import type { Section } from '../../lib/articleSections';
import type { CoverageSnapshot } from '../../lib/aiCoverage';

const snap = (intentScore: number, early: boolean): CoverageSnapshot => ({
  schemaVersion: 1, judgeVersion: 'v', promptVersion: 'v', model: 'm', createdAt: '',
  items: [], buckets: [{ key: 'intent', label: 'Intent', weight: 3, items: 1, covered: 1, earned: 1, max: 1, score: intentScore }],
  answersMainQuestionEarly: early, overall: 50,
});
const sec = (index: number): Section => ({ id: `sec_${index}`, index, headingText: 'H', html: '<p>x</p>' });

describe('introMayExpand', () => {
  it('true when intent bucket score < 50', () => expect(introMayExpand(snap(40, true))).toBe(true));
  it('true when answersMainQuestionEarly is false', () => expect(introMayExpand(snap(90, false))).toBe(true));
  it('false when intent healthy and early answer present', () => expect(introMayExpand(snap(90, true))).toBe(false));
});

describe('selectMode', () => {
  const healthy = snap(90, true);   // intro NOT allowed to expand
  it('LESS in the 6..12 band', () => {
    expect(selectMode({ section: sec(1), expectedLift: 9, rgs: [rg({})], snapshot: healthy, aiTakeover: false })).toBe('less');
  });
  it('term-only section (no guidelines, lift 0) -> LESS (OD-2 [RATIFIED])', () => {
    expect(selectMode({ section: sec(1), expectedLift: 0, rgs: [], snapshot: healthy, aiTakeover: false })).toBe('less');
  });
  it('NORMAL above NORMAL_MIN', () => {
    expect(selectMode({ section: sec(1), expectedLift: 20, rgs: [rg({})], snapshot: healthy, aiTakeover: false })).toBe('normal');
  });
  it('EXPAND when top guideline effort is Large', () => {
    expect(selectMode({ section: sec(1), expectedLift: 20, rgs: [rg({ effort: 'Large' })], snapshot: healthy, aiTakeover: false })).toBe('expand');
  });
  it('intro (index 0) is LESS even at high lift when intro may not expand', () => {
    expect(selectMode({ section: sec(0), expectedLift: 30, rgs: [rg({ effort: 'Large' })], snapshot: healthy, aiTakeover: false })).toBe('less');
  });
  it('intro may be EXPAND when intent is weak', () => {
    expect(selectMode({ section: sec(0), expectedLift: 30, rgs: [rg({ effort: 'Large' })], snapshot: snap(30, false), aiTakeover: false })).toBe('expand');
  });
});
```

- [ ] **Step 2: Run -> fail.**

- [ ] **Step 3: Implement**

```ts
// lib/optimizationPlanner.ts
import type { CoverageSnapshot } from './aiCoverage';   // add to existing type imports

export function introMayExpand(snapshot: CoverageSnapshot): boolean {
  const intentScore = snapshot.buckets.find((b) => b.key === 'intent')?.score ?? 0;
  return intentScore < INTENT_INTRO_MIN || snapshot.answersMainQuestionEarly === false;
}

interface ModeInput {
  section: Section;
  expectedLift: number;
  rgs: RoutedGuideline[];
  snapshot: CoverageSnapshot;
  aiTakeover: boolean;
}

/** Edit-intensity selector. Assumes worthEditing already passed (else the caller skips). */
export function selectMode({ section, expectedLift, rgs, snapshot }: ModeInput): EditMode {
  const expandEligible = rgs[0]?.guideline.effort === 'Large' || hasCriticalMiss(rgs);
  // Intro protection (pillar 4): LESS-only + EXPAND blocked unless intent is genuinely weak.
  if (section.index === 0 && !introMayExpand(snapshot)) return 'less';
  if (expandEligible) return 'expand';
  if (expectedLift > NORMAL_MIN) return 'normal';
  return 'less';
}
```

- [ ] **Step 4: Verify** - `tsc` clean; suite green. Commit.

---

## Task 4: AI-search takeover in `buildOptimizationPlan`

**Files:** Modify `lib/optimizationPlanner.ts`; Test `__tests__/lib/optimizationPlanner.test.ts`

Thread `seoScore`/`aiScore`, compute `aiTakeover` once, drop `secTerms` under takeover (pillar 5, OD-3). This task only wires the takeover flag + `secTerms` gate; `mode` assembly lands in Task 6.

- [ ] **Step 1: Write the failing test** (build a full `PlanInput`; assert takeover empties `missingTerms`)

```ts
// __tests__/lib/optimizationPlanner.test.ts - add (reuse existing section/guideline/context factories in the file)
import { buildOptimizationPlan } from '../../lib/optimizationPlanner';

it('AI-takeover drops per-section missing terms (seo 90, ai 40, gap 50 > 25)', () => {
  const input = makePlanInput({ seoScore: 90, aiScore: 40 }); // helper builds sections+guidelines+context with under-target terms
  const plan = buildOptimizationPlan(input);
  expect(plan.steps.every((s) => s.missingTerms.length === 0)).toBe(true);
  expect(plan.steps.some((s) => s.focus === 'seo-terms')).toBe(false);
});

it('no takeover when the gap is small (seo 90, ai 80, gap 10 <= 25) - terms survive', () => {
  const input = makePlanInput({ seoScore: 90, aiScore: 80 });
  const plan = buildOptimizationPlan(input);
  expect(plan.steps.some((s) => s.missingTerms.length > 0)).toBe(true);
});
```

> If the test file has no `makePlanInput` helper yet, add a small local factory (sections with under-target terms in `context.scoreData.terms`, a couple of guidelines). Keep it LOCAL to the test file.

- [ ] **Step 2: Run -> fail.**

- [ ] **Step 3: Implement** - inside `buildOptimizationPlan` (`:82`), before the `map`:

```ts
export function buildOptimizationPlan(input: PlanInput): Plan {
  const routed = assignGuidelinesToSections(input.guidelines, input.sections);
  const aiTakeover = input.seoScore >= SEO_HIGH && (input.seoScore - input.aiScore) > AI_GAP;   // pillar 5 / OD-3

  const steps: PlanStep[] = input.sections.map((section) => {
    const rgs = routed.get(section.id) ?? [];
    const secText = plainText(section.html);
    const secTerms = aiTakeover ? [] : sectionMissingTerms(secText, input.context);   // takeover drops term work
    // ... rest unchanged for now (Task 6 replaces skip predicate + adds mode) ...
```

- [ ] **Step 4: Verify** - `tsc` clean; new + existing suites green. Commit.

---

## Task 5: LESS system prompt + patch-only user message

**Files:** Modify `lib/optimizationPlanner.ts`; Test `__tests__/lib/optimizationPlanner.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/lib/optimizationPlanner.test.ts - add
import { buildStepPromptForMode, userInstructionForMode } from '../../lib/optimizationPlanner';

const mkStep = (over: Partial<PlanStep>): PlanStep => ({
  sectionId: 's', index: 1, headingText: 'H', html: '<p>x</p>', focus: 'ai-coverage',
  systemPrompt: '', guidelines: [rg({})], missingTerms: [], estimatedTokens: 0, expectedLift: 9,
  reason: '', mode: 'less', ...over,
});
const ctx = { voiceTone: undefined } as any; // minimal ArticleContext for prompt building

describe('LESS prompt', () => {
  it('uses LESS_RULES and OMITS the growth ratchets (no "only refine or expand", no "40 and ~80 words")', () => {
    const p = buildStepPromptForMode(mkStep({ mode: 'less' }), ctx, 'less');
    expect(p).toContain('MINIMAL PATCH');
    expect(p).toContain('MAXIMUM of 2-5 local edits');
    expect(p).not.toContain('only refine or expand');
    expect(p).not.toContain('40 and ~80');
  });
  it('NORMAL delegates to today\'s buildStepPrompt byte-for-byte', () => {
    const step = mkStep({ mode: 'normal' });
    expect(buildStepPromptForMode(step, ctx, 'normal')).toBe(buildStepPrompt(step, ctx));
  });
});

describe('userInstructionForMode', () => {
  it('LESS returns a patch-only instruction (NOT "Improve this section")', () => {
    const u = userInstructionForMode(mkStep({ index: 1 }), 'less');
    expect(u).toBeDefined();
    expect(u).not.toContain('Improve this section');
    expect(u).toContain('minimal number of local edits');
  });
  it('LESS on intro (index 0) adds the one-sentence-answer directive', () => {
    expect(userInstructionForMode(mkStep({ index: 0 }), 'less')).toContain('at most one short sentence');
  });
  it('NORMAL returns undefined (endpoint uses today\'s literal)', () => {
    expect(userInstructionForMode(mkStep({ mode: 'normal' }), 'normal')).toBeUndefined();
  });
  it('EXPAND returns undefined', () => {
    expect(userInstructionForMode(mkStep({ mode: 'expand' }), 'expand')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run -> fail.**

- [ ] **Step 3: Implement**

```ts
// lib/optimizationPlanner.ts

const LESS_RULES = `You are an expert SEO content editor making a MINIMAL PATCH to ONE section of an HTML article.

RULES:
- Make a MAXIMUM of 2-5 local edits. Preserve MORE THAN 95% of the original wording verbatim.
- Do NOT add paragraphs. Do NOT rewrite. Do NOT expand or lengthen the section.
- Only patch the specific uncovered AI-search signals listed below - change nothing else.
- Keep the SAME LANGUAGE as the input (auto-detect - do NOT translate)
- Preserve EVERY heading, <a> link, <img>, and list EXACTLY as written`;

function buildLessPrompt(step: PlanStep, context: ArticleContext): string {
  const brand = context.voiceTone ? `\n\nMatch this brand voice: ${context.voiceTone}` : '';
  const block = focusBlock(step);   // same focus block as NORMAL - reuse
  return `${LESS_RULES}\n\n${block}${brand}\n\n${NEGATIVE_CONSTRAINTS}\n\n${OUTPUT_RULE}`;
}

/** Mode -> system prompt. NORMAL/EXPAND delegate to the existing buildStepPrompt byte-for-byte. */
export function buildStepPromptForMode(step: PlanStep, context: ArticleContext, mode: EditMode): string {
  if (step.focus === 'skip') return '';
  return mode === 'less' ? buildLessPrompt(step, context) : buildStepPrompt(step, context);
}

const LESS_USER_BASE =
  'Patch this section with the minimal number of local edits. Do not rewrite it, do not add '
  + 'paragraphs, and preserve more than 95% of the wording. Only fix the signals in the instructions.';
const LESS_INTRO_EXTRA =
  ' If the intro does not directly answer the main question, add at most one short sentence that does '
  + '- never a new paragraph.';

/** Mode -> user message. LESS carries a patch-only instruction; NORMAL/EXPAND stay undefined so the
 *  endpoint uses today's "Improve this section:\n\n"+html literal (byte-for-byte). */
export function userInstructionForMode(step: PlanStep, mode: EditMode): string | undefined {
  if (mode !== 'less') return undefined;
  const extra = step.index === 0 ? LESS_INTRO_EXTRA : '';
  return `${LESS_USER_BASE}${extra}\n\n${step.html}`;
}
```

- [ ] **Step 4: Verify** - `tsc` clean; suite green. Commit.

---

## Task 6: Wire `worthEditing` + `mode` + prompts into `buildOptimizationPlan`

**Files:** Modify `lib/optimizationPlanner.ts`; Test `__tests__/lib/optimizationPlanner.test.ts`

Replace the skip predicate with `!worthEditing`, and set `mode`/`systemPrompt`/`userInstruction` per step.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/lib/optimizationPlanner.test.ts - add
it('term-only section (no guidelines, under-target terms) gets a LESS edit, not skip (OD-2 [RATIFIED])', () => {
  const input = makePlanInput({ seoScore: 50, aiScore: 50, termOnlyEverySection: true });
  const plan = buildOptimizationPlan(input);
  expect(plan.steps.every((s) => s.mode === 'less' && s.focus !== 'skip')).toBe(true);
});

it('assigns modes: high-lift -> normal, mid-lift -> less', () => {
  const input = makePlanInput({ seoScore: 50, aiScore: 50 }); // some sections lift>12, some 6..12
  const plan = buildOptimizationPlan(input);
  const modes = new Set(plan.steps.filter((s) => s.focus !== 'skip').map((s) => s.mode));
  expect(modes.has('less') || modes.has('normal')).toBe(true);
});

it('LESS step carries a userInstruction; NORMAL step does not', () => {
  const input = makePlanInput({ seoScore: 50, aiScore: 50 });
  const plan = buildOptimizationPlan(input);
  const less = plan.steps.find((s) => s.mode === 'less' && s.focus !== 'skip');
  const normal = plan.steps.find((s) => s.mode === 'normal' && s.focus !== 'skip');
  if (less) expect(less.userInstruction).toBeDefined();
  if (normal) expect(normal.userInstruction).toBeUndefined();
});
```

- [ ] **Step 2: Run -> fail.**

- [ ] **Step 3: Implement** - the `map` body in `buildOptimizationPlan` becomes:

```ts
  const snapshot = input.context.coverage;   // non-null in the planner path (endpoint gates on ctx)

  const steps: PlanStep[] = input.sections.map((section) => {
    const rgs = routed.get(section.id) ?? [];
    const secText = plainText(section.html);
    const secTerms = aiTakeover ? [] : sectionMissingTerms(secText, input.context);
    const expectedLift = diminishingLift(rgs.map((r) => r.guideline.projectedLift));
    const base = { sectionId: section.id, index: section.index, headingText: section.headingText, html: section.html, guidelines: rgs, missingTerms: secTerms };

    // NEW skip gate (replaces rgs.length===0 && secTerms.length===0)
    if (!worthEditing({ expectedLift, rgs, secTerms, aiTakeover })) {
      return { ...base, focus: 'skip' as const, systemPrompt: '', estimatedTokens: 0, expectedLift, reason: 'Skipped - below benefit threshold', mode: 'normal' as const };
    }

    const focus = focusFor(rgs, secTerms);
    const mode = snapshot
      ? selectMode({ section, expectedLift, rgs, snapshot, aiTakeover })
      : 'normal';   // defensive: if no snapshot, behave as NORMAL
    const draft: PlanStep = { ...base, focus, expectedLift, estimatedTokens: estimateStepTokens(section), systemPrompt: '', reason: rgs.length ? `Optimize: ${rgs.length} guidelines` : 'Optimize: under-target terms', mode };
    return {
      ...draft,
      systemPrompt: buildStepPromptForMode(draft, input.context, mode),
      userInstruction: userInstructionForMode(draft, mode),
    };
  });
```

> Note: `snapshot` may be typed `CoverageSnapshot | null` (`articleContext.ts:24`). Guard as above so the planner never throws if coverage is absent, defaulting to NORMAL. `worthEditing`'s critical-miss + `>= LESS_MIN` branches keep behaviour sane without a snapshot.

- [ ] **Step 4: Verify** - `tsc` clean; ALL of `__tests__/lib/optimizationPlanner.test.ts` green. Commit.

---

## Task 7: All-NORMAL byte-for-byte regression test

**Files:** Test only - `__tests__/lib/optimizationPlanner.test.ts`

Prove that when every section classifies NORMAL (no takeover, no intro-block, all `expectedLift > NORMAL_MIN`), the plan's `systemPrompt` equals today's `buildStepPrompt` output AND `userInstruction` is undefined for every step.

- [ ] **Step 1: Write the test**

```ts
// __tests__/lib/optimizationPlanner.test.ts - add
describe('NORMAL byte-for-byte regression', () => {
  it('all-NORMAL run: systemPrompt equals buildStepPrompt and userInstruction is undefined', () => {
    // Build an input where every non-intro section has expectedLift > NORMAL_MIN (12),
    // no takeover (seo 50 / ai 50), intro is index 0 but has a critical miss so it may expand -> still NORMAL-eligible.
    const input = makePlanInput({ seoScore: 50, aiScore: 50, highLiftEverySection: true });
    const plan = buildOptimizationPlan(input);
    for (const step of plan.steps) {
      if (step.focus === 'skip') continue;
      expect(step.mode).toBe('normal');
      // The exact prompt today's D would have produced for this step:
      expect(step.systemPrompt).toBe(buildStepPrompt(step, input.context));
      expect(step.userInstruction).toBeUndefined();
    }
  });
});
```

> `makePlanInput({ highLiftEverySection: true })` must construct guidelines whose `projectedLift` sum (after diminishing) exceeds 12 per section, snapshot with a weak intent bucket (so index-0 intro is NOT force-LESS), and no `effort:'Large'` top guideline (so mode is NORMAL not EXPAND). If the factory can't easily avoid intro-LESS, assert only on non-intro steps (`step.index !== 0`) - the guarantee that matters is NORMAL sections are byte-for-byte.

- [ ] **Step 2: Run -> pass** (Task 6 already produces this). If it fails, the mode/prompt wiring diverged from D - fix Task 6, not the test.

- [ ] **Step 3: Verify** - full `optimizationPlanner` suite + the D `optimizeGuidelineRouting` suite green (26 baseline tests). Commit.

---

## Task 8: Endpoint wiring - score reads + mode-varying user message + `section` SSE contract

**Files:** Modify `pages/api/articles/optimize-sections.ts`, `lib/optimizeSectionEvents.ts`; extend `__tests__/api/articles-optimize-sections-guard.test.ts`

> **Ratification 2 (UX contract):** the existing `section` SSE event must carry `focus: StepFocus`, `mode: EditMode`, `reason: string` sourced VERBATIM from `PlanStep`, forwarded via `buildSectionEvent(section, result, step)` on BOTH branches — the skip branch (`optimize-sections.ts:148`) and the changed branch (`:188`). This is the ONLY consumer-facing contract the UX sub-project depends on (no score field); keep it minimal + additive (Part-8-clean for the UX side).

- [ ] **Step 0: Add the optional fields to `buildSectionEvent`/`SectionEvent`** (`lib/optimizeSectionEvents.ts`) — additive only: `focus?: StepFocus`, `mode?: EditMode`, `reason?: string` on `SectionEvent`; `buildSectionEvent` gains an optional `step?: PlanStep` param and copies `step.focus`/`step.mode`/`step.reason` onto the event when provided. Existing callers that omit `step` stay byte-for-byte.

- [ ] **Step 1: Write the failing test** (LOCAL mocks of `buildArticleContext`, `getOrgUsage5h`, and `fetch`; add the score reads to the mock surface)

```ts
// __tests__/api/articles-optimize-sections-guard.test.ts - add cases
// (mirror the existing mock setup in this file: jest.mock for buildArticleContext / getOrgUsage5h / global fetch)

it('NORMAL step sends the "Improve this section" user message (byte-for-byte)', async () => {
  // arrange: plan yields one NORMAL step (userInstruction undefined)
  // act: run the handler; capture the fetch body
  // assert: the user message === `Improve this section:\n\n${html}`
});

it('LESS step sends step.userInstruction as the user message (not "Improve this section")', async () => {
  // arrange: plan yields one LESS step with a userInstruction
  // assert: fetch user message === step.userInstruction; does NOT contain "Improve this section"
});

it('skip step makes NO fetch and emits changed:false WITH focus/mode/reason from the step', async () => {
  // arrange: plan yields a skip step (focus:'skip', mode:'normal', reason:'Skipped - below benefit threshold')
  // assert: fetch NOT called for it; the section event has changed:false AND focus/mode/reason === the step's
});

it('changed step emits a section event carrying focus/mode/reason from the step (UX contract)', async () => {
  // arrange: plan yields one edited step (e.g. LESS)
  // assert: the section event has changed:true AND focus/mode/reason === the step's focus/mode/reason
});
```

> Follow the existing guard test's structure for capturing the DeepSeek `fetch` call and reading `JSON.parse(body).messages[1].content`. Keep every mock LOCAL to this file.

- [ ] **Step 2: Run -> fail.**

- [ ] **Step 3: Implement** - three edits in `optimize-sections.ts` (plus the `lib/optimizeSectionEvents.ts` field additions from Step 0).

(a) Read the two scores server-side and pass them into the plan (near `:130-133`):

```ts
// after `const guidelines = ...` (:128) and before building the plan:
const seoScore = readSeoScore(ctx, scoreData, content);   // computeContentScore result / persisted content_score
const aiScore = ctx ? await readLatestAiScore(Number(articleId)) : 0;   // latest ai_visibility_runs.score

const plan: Plan = ctx
  ? buildOptimizationPlan({ sections, guidelines, context: ctx, budgetRemaining: usage.limit - usage.used, seoScore, aiScore })
  : legacyPlan(sections, scoreData, content);
```

- `readSeoScore`: prefer the already-computed score - `scoreData?._computed_score` (`pages/api/articles/[id]/index.ts:78` shows it is persisted there), falling back to `ctx.scoreData?._computed_score`. Do NOT recompute `computeContentScore` in the planner (PURE constraint) - if neither is present, pass `0` (no takeover).
- `readLatestAiScore(articleId)`: a small module-private helper in the endpoint that runs the SAME query as `pages/api/articles/[id]/index.ts:46-52` (`SELECT score FROM ai_visibility_runs WHERE article_id = ? ORDER BY created_at DESC, id DESC LIMIT 1`) and returns `row?.score ?? 0`. Server-side only.

(b) Vary the user message by mode (`:165`):

```ts
messages: [
  { role: 'system', content: step.systemPrompt },
  { role: 'user', content: step.userInstruction ?? `Improve this section:\n\n${section.html}` },
],
```

(c) `legacyPlan` (`:48-65`): add `mode: 'normal'` to each step literal (and leave `userInstruction` unset) so the draft path type-checks and stays byte-for-byte legacy. `legacyPlan` does not need `seoScore`/`aiScore` (draft path, no takeover).

(d) Forward `focus`/`mode`/`reason` onto BOTH `section` SSE events (Ratification 2): pass `step` into `buildSectionEvent(section, result, step)` at the skip branch (`:148`) and the changed branch (`:188`) so each emitted `section` event carries the step's `focus`/`mode`/`reason` verbatim. No score field. This is the only field the UX layer consumes.

- [ ] **Step 4: Verify** - `npx tsc --noEmit` clean; `npx jest __tests__/api/articles-optimize-sections-guard.test.ts --ci` green; the D endpoint guard cases still pass. Commit.

---

## Definition of done

- `worthEditing` gates on `expectedLift` tiers (skip < 6, LESS 6-12, NORMAL > 12) with a critical-miss override; term-only sections get a LESS (minimal) edit when NOT in AI-takeover, dropped only by takeover (OD-2 [RATIFIED]).
- Three modes wired: LESS (new prompt + patch-only user message), NORMAL (byte-for-byte), EXPAND (gated).
- Intro (index 0) is LESS-only + EXPAND-blocked unless intent is weak; intro-LESS adds at most a one-sentence answer.
- AI-takeover drops term work when `seoScore >= 85` and `seoScore - aiScore > 25`.
- `PlanInput` carries `seoScore`/`aiScore` (threaded from the endpoint); `PlanStep` carries `mode`/`userInstruction`.
- The `section` SSE event carries `focus`/`mode`/`reason` verbatim from `PlanStep` on both the skip and changed branches, via `buildSectionEvent(section, result, step)` (the only UX-layer contract; no score field) (Ratification 2).
- Task 7 proves all-NORMAL is byte-for-byte; D's 26 tests + endpoint guard suite stay green.
- `tsc --noEmit` clean. Implementers did NOT run `npm run build`.
