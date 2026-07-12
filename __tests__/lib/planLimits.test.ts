import {
  buildPlanMetrics,
  overallUsagePct,
  resolvePlanSlug,
  formatPlanStatus,
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
});
