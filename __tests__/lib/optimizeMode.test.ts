import {
  selectOptimizeMode,
  SEO_READY,
  SEO_WEAK,
  TARGET_AI,
  TARGET_SEO,
  DEFAULT_MAX_ROUNDS,
} from '../../lib/optimizeMode';

describe('selectOptimizeMode', () => {
  it('routes to ai-only when SEO is ready but AI is weak', () => {
    expect(selectOptimizeMode(SEO_READY, 30)).toBe('ai-only');
  });

  it('routes to seo-first when SEO is below ready threshold', () => {
    expect(selectOptimizeMode(50, 70)).toBe('seo-first');
  });

  it('routes to minimal when both SEO and AI are strong', () => {
    expect(selectOptimizeMode(SEO_READY, TARGET_AI)).toBe('minimal');
  });

  it('routes to full when both dimensions are weak', () => {
    expect(selectOptimizeMode(SEO_WEAK - 5, SEO_WEAK - 5)).toBe('full');
  });
});

describe('optimizeMode constants', () => {
  it('uses Surfer parity targets', () => {
    expect(TARGET_SEO).toBe(70);
    expect(TARGET_AI).toBe(65);
    expect(DEFAULT_MAX_ROUNDS).toBe(2);
  });
});
