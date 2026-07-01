import { estimateStepTokens, diminishingLift, buildOptimizationPlan } from '../../lib/optimizationPlanner';
import type { PlanInput } from '../../lib/optimizationPlanner';
import type { Section } from '../../lib/articleSections';
import type { Guideline } from '../../lib/recommendationEngine';
import type { ArticleContext } from '../../lib/articleContext';

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
