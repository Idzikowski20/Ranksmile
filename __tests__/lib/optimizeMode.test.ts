import {
  selectOptimizeMode,
  SEO_REBUILD_BELOW,
  shouldSkipOptimize,
  SEO_READY,
  SEO_WEAK,
  TARGET_AI,
  TARGET_SEO,
  DEFAULT_MAX_ROUNDS,
} from '@/src/core/domain/optimize/optimizeMode';

describe('selectOptimizeMode', () => {
  it('routes to ai-only when SEO is ready but AI is weak (first run)', () => {
    expect(selectOptimizeMode(SEO_READY, 30, 'first_run')).toBe('ai-only');
  });

  it('routes to ai-only when SEO is ready and AI is below target (not minimal at TARGET_AI-5)', () => {
    // SEO 82 / AI 60 used to flip to minimal and stop pushing AI Search.
    expect(selectOptimizeMode(SEO_READY, TARGET_AI - 5, 'first_run')).toBe('ai-only');
    expect(selectOptimizeMode(SEO_READY, TARGET_AI - 1, 'first_run')).toBe('ai-only');
  });

  it('routes to seo-first in the 60-79 band, rebuild (full) below 60', () => {
    // Surfer-model bars: "strong" is 80, and a weak article (below 60) gets rebuilt
    // toward its own content plan rather than patched.
    expect(selectOptimizeMode(70, 70, 'first_run')).toBe('seo-first');
    expect(selectOptimizeMode(SEO_REBUILD_BELOW, 70, 'first_run')).toBe('seo-first');
    expect(selectOptimizeMode(SEO_REBUILD_BELOW - 1, 70, 'first_run')).toBe('full');
  });

  it('routes to minimal only when SEO is ready and AI hits target', () => {
    expect(selectOptimizeMode(SEO_READY, TARGET_AI, 'first_run')).toBe('minimal');
  });

  it('routes to full when both dimensions are weak', () => {
    expect(selectOptimizeMode(SEO_WEAK - 5, SEO_WEAK - 5, 'first_run')).toBe('full');
  });

  it('follow_up no longer forces minimal — mode comes from current scores', () => {
    // One prior AO run (even a no-op) used to lock the article out of real work
    // forever: a degraded article at SEO 68 got mode minimal and one cosmetic edit.
    expect(selectOptimizeMode(30, 20, 'follow_up')).toBe('full');
    expect(selectOptimizeMode(SEO_READY, TARGET_AI, 'follow_up')).toBe('minimal');
  });
});

describe('shouldSkipOptimize', () => {
  it('is true only when both TARGET_SEO and TARGET_AI are met (AND)', () => {
    expect(shouldSkipOptimize(TARGET_SEO, TARGET_AI)).toBe(true);
    expect(shouldSkipOptimize(TARGET_SEO, TARGET_AI - 1)).toBe(false);
    expect(shouldSkipOptimize(TARGET_SEO - 1, TARGET_AI)).toBe(false);
    expect(shouldSkipOptimize(89, 85)).toBe(false);
    expect(shouldSkipOptimize(90, 84)).toBe(false);
    expect(shouldSkipOptimize(95, 90)).toBe(true);
  });
});

describe('optimizeMode constants', () => {
  it('uses v4.1 skip targets 90/85', () => {
    expect(TARGET_SEO).toBe(90);
    expect(TARGET_AI).toBe(85);
    expect(DEFAULT_MAX_ROUNDS).toBe(2);
  });
});
