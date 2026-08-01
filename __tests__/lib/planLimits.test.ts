import {
  buildPlanMetrics,
  overallUsagePct,
  resolvePlanSlug,
  formatPlanStatus,
  formatTrialCountdown,
} from '../../lib/planLimits';

describe('planLimits', () => {
  it('resolvePlanSlug falls back to growth', () => {
    expect(resolvePlanSlug(null)).toBe('growth');
    expect(resolvePlanSlug('invalid')).toBe('growth');
    expect(resolvePlanSlug('starter')).toBe('starter');
  });

  it('buildPlanMetrics computes pct and overall peak', () => {
    const metrics = buildPlanMetrics('growth', {
      documents: 15,
      aiPrompts: 40,
      brandSpaces: 2,
      keywordResearch: 10,
    });
    const docs = metrics.find((m) => m.key === 'documents');
    expect(docs?.pct).toBe(50);
    expect(overallUsagePct(metrics)).toBe(80);
  });

  it('formatPlanStatus shows trial end date', () => {
    const line = formatPlanStatus('trialing', '2026-07-16T00:00:00.000Z', 'monthly');
    expect(line).toContain('Trial');
    expect(line).toContain('Jul');
  });

  it('formatTrialCountdown formats remaining d/h/m', () => {
    const now = Date.parse('2026-08-01T12:00:00.000Z');
    expect(formatTrialCountdown('2026-08-03T22:30:00.000Z', now)).toBe('2d, 10h, 30m');
    expect(formatTrialCountdown('2026-08-01T15:05:00.000Z', now)).toBe('3h, 5m');
    expect(formatTrialCountdown('2026-08-01T12:12:00.000Z', now)).toBe('12m');
    expect(formatTrialCountdown('2026-07-01T00:00:00.000Z', now)).toBe('0m');
  });
});
