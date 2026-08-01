import {
  chooseStrategyFromDiagnosis,
  resolveOptimizationPolicy,
} from '../../../lib/ao/optimizationPolicy';

describe('weak article strategy routing', () => {
  it('routes very weak content to deep_optimize (not auto whole_article)', () => {
    expect(
      chooseStrategyFromDiagnosis({
        scores: { seo: 28, content: 38, ai: 21 },
        structural: 'weak',
        intent: 'acceptable',
        highValueGaps: 4,
      }),
    ).toBe('deep_optimize');
  });

  it('keeps deep_optimize for mid-weak content that still has structure', () => {
    expect(
      chooseStrategyFromDiagnosis({
        scores: { seo: 55, content: 58, ai: 40 },
        structural: 'acceptable',
        intent: 'acceptable',
        highValueGaps: 5,
      }),
    ).toBe('deep_optimize');
  });

  it('resolveOptimizationPolicy preserves explicit whole_article_fallback', () => {
    const p = resolveOptimizationPolicy({
      strategy: 'whole_article_fallback',
      scores: { seo: 28, content: 38, ai: 21 },
      html: '<h2>A</h2><p>x</p>',
      sectionCount: 4,
      uncoveredCoverage: 6,
    });
    expect(p.strategy).toBe('whole_article_fallback');
    expect(p.faq.enabled).toBe(true);
  });
});
