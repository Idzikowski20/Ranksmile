import { estimateStepTokens, diminishingLift, buildOptimizationPlan, buildStepPrompt, worthEditing, selectMode, introMayExpand } from '../../lib/optimizationPlanner';
import type { PlanInput, PlanStep } from '../../lib/optimizationPlanner';
import type { Section } from '../../lib/articleSections';
import type { Guideline } from '../../lib/recommendationEngine';
import type { ArticleContext } from '../../lib/articleContext';
import type { RoutedGuideline } from '../../lib/optimizeGuidelineRouting';
import type { CoverageSnapshot } from '../../lib/aiCoverage';

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

const rgFor = (over: Partial<Guideline>): RoutedGuideline => ({
  guideline: {
    id: 'g', coverageItemId: 'c', group: 'knowledge', title: 'T', instruction: 'I',
    importance: 'recommended', status: 'open', projectedLift: 10, effort: 'Easy', easyWin: false, ...over,
  },
  confidence: 0.8, reason: 'r', priority: 1,
});

describe('worthEditing', () => {
  it('skips below LESS_MIN (expectedLift 5)', () => {
    expect(worthEditing({ expectedLift: 5, rgs: [rgFor({})], secTerms: [], aiTakeover: false })).toBe(false);
  });
  it('keeps at/above LESS_MIN (expectedLift 6)', () => {
    expect(worthEditing({ expectedLift: 6, rgs: [rgFor({})], secTerms: [], aiTakeover: false })).toBe(true);
  });
  it('term-only section (expectedLift 0, secTerms present) is worth a LESS edit (OD-2 [RATIFIED])', () => {
    expect(worthEditing({ expectedLift: 0, rgs: [], secTerms: ['foo', 'bar'], aiTakeover: false })).toBe(true);
  });
  it('term-only section under AI-takeover is dropped (takeover suppresses the term path)', () => {
    expect(worthEditing({ expectedLift: 0, rgs: [], secTerms: ['foo', 'bar'], aiTakeover: true })).toBe(false);
  });
  it('critical miss overrides the threshold (never skipped even at expectedLift 0)', () => {
    expect(worthEditing({ expectedLift: 0, rgs: [rgFor({ importance: 'critical' })], secTerms: [], aiTakeover: false })).toBe(true);
  });
});

const snap = (intentScore: number, early: boolean): CoverageSnapshot => ({
  schemaVersion: 1, judgeVersion: 'v', promptVersion: 'v', model: 'm', createdAt: '',
  items: [], buckets: [{ key: 'intent', label: 'Intent', weight: 3, items: 1, covered: 1, earned: 1, max: 1, score: intentScore }],
  answersMainQuestionEarly: early, overall: 50,
});
const secAt = (index: number): Section => ({ id: `sec_${index}`, index, headingText: 'H', html: '<p>x</p>' });

describe('introMayExpand', () => {
  it('true when intent bucket score < 50', () => expect(introMayExpand(snap(40, true))).toBe(true));
  it('true when answersMainQuestionEarly is false', () => expect(introMayExpand(snap(90, false))).toBe(true));
  it('false when intent healthy and early answer present', () => expect(introMayExpand(snap(90, true))).toBe(false));
});

describe('selectMode', () => {
  const healthy = snap(90, true);   // intro NOT allowed to expand
  it('LESS in the 6..12 band', () => {
    expect(selectMode({ section: secAt(1), expectedLift: 9, rgs: [rgFor({})], snapshot: healthy, aiTakeover: false })).toBe('less');
  });
  it('term-only section (no guidelines, lift 0) -> LESS (OD-2 [RATIFIED])', () => {
    expect(selectMode({ section: secAt(1), expectedLift: 0, rgs: [], snapshot: healthy, aiTakeover: false })).toBe('less');
  });
  it('NORMAL above NORMAL_MIN', () => {
    expect(selectMode({ section: secAt(1), expectedLift: 20, rgs: [rgFor({})], snapshot: healthy, aiTakeover: false })).toBe('normal');
  });
  it('EXPAND when top guideline effort is Large', () => {
    expect(selectMode({ section: secAt(1), expectedLift: 20, rgs: [rgFor({ effort: 'Large' })], snapshot: healthy, aiTakeover: false })).toBe('expand');
  });
  it('intro (index 0) is LESS even at high lift when intro may not expand', () => {
    expect(selectMode({ section: secAt(0), expectedLift: 30, rgs: [rgFor({ effort: 'Large' })], snapshot: healthy, aiTakeover: false })).toBe('less');
  });
  it('intro may be EXPAND when intent is weak', () => {
    expect(selectMode({ section: secAt(0), expectedLift: 30, rgs: [rgFor({ effort: 'Large' })], snapshot: snap(30, false), aiTakeover: false })).toBe('expand');
  });
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
  sections: [], guidelines: [],
  context: ctx(), budgetRemaining: 1_000_000, seoScore: 0, aiScore: 0, ...over,
});

describe('buildOptimizationPlan focus + skip', () => {
  it('skip when nothing routed and no under-target terms', () => {
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

describe('buildOptimizationPlan AI-takeover (pillar 5 / OD-3)', () => {
  const makePlanInput = (over: Partial<PlanInput>): PlanInput => {
    const sections = [
      { id: 's0', index: 0, headingText: 'Intro', html: '<h2>Intro</h2><p>short intro text</p>' },
      { id: 's1', index: 1, headingText: 'Body', html: '<h2>Body</h2><p>short body text</p>' },
    ];
    const guidelines = [
      gl({ coverageItemId: 'g0', title: 'Cover: Intro', instruction: 'intro', sectionId: 's0' }),
      gl({ coverageItemId: 'g1', title: 'Cover: Body', instruction: 'body', sectionId: 's1' }),
    ];
    const context = ctx({
      scoreData: {
        terms: [
          { term: 'react hooks', target_count: 5 },
          { term: 'useEffect', target_count: 5 },
        ],
        words_target: 100, words_min: 50, words_max: 200,
        headings_target: 2, headings_min: 1, headings_max: 4,
      } as ArticleContext['scoreData'],
    });
    return input({ sections, guidelines, context, ...over });
  };

  it('AI-takeover drops per-section missing terms (seo 90, ai 40, gap 50 > 25)', () => {
    const planInput = makePlanInput({ seoScore: 90, aiScore: 40 });
    const plan = buildOptimizationPlan(planInput);
    expect(plan.steps.every((s) => s.missingTerms.length === 0)).toBe(true);
    expect(plan.steps.some((s) => s.focus === 'seo-terms')).toBe(false);
  });

  it('no takeover when the gap is small (seo 90, ai 80, gap 10 <= 25) - terms survive', () => {
    const planInput = makePlanInput({ seoScore: 90, aiScore: 80 });
    const plan = buildOptimizationPlan(planInput);
    expect(plan.steps.some((s) => s.missingTerms.length > 0)).toBe(true);
  });
});

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

const step = (over: Partial<PlanStep>): PlanStep => ({
  sectionId: 's', index: 0, headingText: 'H', html: '<p>x</p>', focus: 'seo-terms',
  systemPrompt: '', guidelines: [], missingTerms: [], estimatedTokens: 0, expectedLift: 0, reason: '', mode: 'normal', ...over,
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
