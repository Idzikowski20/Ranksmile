import {
  chooseStrategyFromDiagnosis,
  resolveOptimizationPolicy,
} from '@/src/infrastructure/ao/optimizationPolicy';

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

  /**
   * Explicit means explicit, for every strategy alike. Weak scores are exactly when a
   * caller reaches for a bounded precision pass on purpose — a surgical edit from a
   * Priority Action, say — and re-diagnosing it away hands them a 20-step rebuild with
   * allowNewHeading instead of the operation they asked for.
   */
  it('preserves an explicitly requested precision even on weak scores', () => {
    const weak = {
      scores: { seo: 28, content: 38, ai: 21 },
      html: '<h2>A</h2><p>x</p>',
      sectionCount: 4,
      uncoveredCoverage: 6,
    };
    expect(resolveOptimizationPolicy({ ...weak, strategy: 'precision' }).strategy).toBe('precision');
    // Nothing requested → the diagnosis still owns the decision.
    expect(resolveOptimizationPolicy(weak).strategy).toBe('deep_optimize');
  });

  it('preserves an explicitly requested enrichment on weak scores', () => {
    const p = resolveOptimizationPolicy({
      strategy: 'enrichment',
      scores: { seo: 28, content: 38, ai: 21 },
      html: '<h2>A</h2><p>x</p>',
      sectionCount: 4,
      uncoveredCoverage: 6,
    });
    expect(p.strategy).toBe('enrichment');
  });
});
