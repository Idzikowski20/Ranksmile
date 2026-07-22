import { STOP_SLOP_RULES, withStopSlop } from '../../lib/stopSlopPrompt';
import { buildStepPrompt } from '../../lib/optimizationPlanner';
import type { PlanStep } from '../../lib/optimizationPlanner';
import type { ArticleContext } from '../../lib/articleContext';

describe('stopSlopPrompt', () => {
  it('exports HUMAN PROSE rules from Stop Slop', () => {
    expect(STOP_SLOP_RULES).toContain('HUMAN PROSE (Stop Slop');
    expect(STOP_SLOP_RULES).toContain("Here's the thing");
    expect(STOP_SLOP_RULES).toContain('active voice');
    expect(STOP_SLOP_RULES).toContain('em dashes');
  });

  it('withStopSlop is idempotent', () => {
    const once = withStopSlop('RULES:\n- keep language');
    const twice = withStopSlop(once);
    expect(twice).toBe(once);
    expect((once.match(/HUMAN PROSE \(Stop Slop/g) || []).length).toBe(1);
  });
});

describe('Auto-Optimize prompts include Stop Slop', () => {
  const ctx = {
    articleId: 1,
    keyword: 'seo',
    scoreData: null,
    breakdown: null,
    coverage: null,
    paa: [],
    terms: [],
    competitors: [],
  } as ArticleContext;

  const step = {
    sectionId: 's1',
    index: 0,
    html: '<p>Hi</p>',
    focus: 'readability',
    mode: 'normal',
    guidelines: [],
    missingTerms: [],
    estimatedTokens: 100,
    expectedLift: 5,
    reason: 'test',
    systemPrompt: '',
  } as PlanStep;

  it('buildStepPrompt embeds Stop Slop', () => {
    const p = buildStepPrompt(step, ctx);
    expect(p).toContain('HUMAN PROSE (Stop Slop');
    expect(p).toContain('game-changer');
  });
});
