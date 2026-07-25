import {
  selectOptimizeMode,
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

  it('routes to seo-first when SEO is below ready threshold', () => {
    expect(selectOptimizeMode(50, 70, 'first_run')).toBe('seo-first');
  });

  it('routes to minimal when both SEO and AI are strong', () => {
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

describe('optimizeMode constants', () => {
  it('uses Ranksmile parity targets', () => {
    expect(TARGET_SEO).toBe(80);
    expect(TARGET_AI).toBe(65);
    expect(DEFAULT_MAX_ROUNDS).toBe(2);
  });
});
