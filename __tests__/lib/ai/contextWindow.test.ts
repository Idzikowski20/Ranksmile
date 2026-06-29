import { contextUsageColor, contextUsagePct, CONTEXT_WINDOW_TOKENS } from '../../../lib/ai/contextWindow';

describe('context window usage', () => {
  it('colours by threshold (accent <60, amber 60-80, red >80)', () => {
    expect(contextUsageColor(59)).toBe('#783afb');
    expect(contextUsageColor(60)).toBe('#783afb');
    expect(contextUsageColor(60.1)).toBe('#d97706');
    expect(contextUsageColor(80)).toBe('#d97706');
    expect(contextUsageColor(80.1)).toBe('#ef4444');
  });

  it('computes pct of the context window and clamps to 100', () => {
    expect(contextUsagePct(0)).toBe(0);
    expect(contextUsagePct(-5)).toBe(0);
    expect(contextUsagePct(CONTEXT_WINDOW_TOKENS / 2)).toBeCloseTo(50, 5);
    expect(contextUsagePct(CONTEXT_WINDOW_TOKENS * 2)).toBe(100);
  });
});
