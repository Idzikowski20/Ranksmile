import { contextUsageColor, contextUsagePct, CONTEXT_WINDOW_TOKENS } from '../../../lib/ai/contextWindow';

describe('context window usage', () => {
  it('colours by threshold (green ≤50, yellow ≤75, orange ≤90, red >90)', () => {
    expect(contextUsageColor(50)).toBe('#1ab25e');
    expect(contextUsageColor(50.1)).toBe('#eab308');
    expect(contextUsageColor(75)).toBe('#eab308');
    expect(contextUsageColor(75.1)).toBe('#f97316');
    expect(contextUsageColor(90)).toBe('#f97316');
    expect(contextUsageColor(90.1)).toBe('#ef4444');
  });

  it('computes pct of the context window and clamps to 100', () => {
    expect(contextUsagePct(0)).toBe(0);
    expect(contextUsagePct(-5)).toBe(0);
    expect(contextUsagePct(CONTEXT_WINDOW_TOKENS / 2)).toBeCloseTo(50, 5);
    expect(contextUsagePct(CONTEXT_WINDOW_TOKENS * 2)).toBe(100);
  });
});
