import {
  selectOptimizeMode,
  shouldSkipOptimize,
  SEO_READY,
  SEO_WEAK,
  TARGET_AI,
  TARGET_SEO,
  DEFAULT_MAX_ROUNDS,
} from '../../lib/optimizeMode';

describe('selectOptimizeMode', () => {
  it('routes to ai-only when SEO is ready but AI is weak (first run)', () => {
    expect(selectOptimizeMode(SEO_READY, 30, 'first_run')).toBe('ai-only');
  });

  it('routes to ai-only when SEO is ready and AI is below target (not minimal at TARGET_AI-5)', () => {
    // SEO 82 / AI 60 used to flip to minimal and stop pushing AI Search.
    expect(selectOptimizeMode(SEO_READY, TARGET_AI - 5, 'first_run')).toBe('ai-only');
    expect(selectOptimizeMode(SEO_READY, TARGET_AI - 1, 'first_run')).toBe('ai-only');
  });

  it('routes to seo-first when SEO is below ready threshold', () => {
    expect(selectOptimizeMode(50, 70, 'first_run')).toBe('seo-first');
  });

  it('routes to minimal only when SEO is ready and AI hits target', () => {
    expect(selectOptimizeMode(SEO_READY, TARGET_AI, 'first_run')).toBe('minimal');
  });

  it('routes to full when both dimensions are weak', () => {
    expect(selectOptimizeMode(SEO_WEAK - 5, SEO_WEAK - 5, 'first_run')).toBe('full');
  });

  it('forces minimal on follow_up regardless of scores', () => {
    expect(selectOptimizeMode(30, 20, 'follow_up')).toBe('minimal');
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
