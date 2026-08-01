import {
  nextPlan,
  previousPlan,
  resolveCtaState,
  ctaLabel,
  billingSavePercentLabel,
  PLAN_DEFINITIONS,
} from '../../../lib/pricing/planDefinition';

describe('planDefinition hierarchy + CTA', () => {
  it('resolves previous / next along PlanHierarchy', () => {
    expect(previousPlan('starter')).toBeNull();
    expect(nextPlan('starter')).toBe('growth');
    expect(previousPlan('growth')).toBe('starter');
    expect(nextPlan('agency')).toBeNull();
  });

  it('maps CTA states from current vs target rank', () => {
    expect(resolveCtaState(null, 'growth')).toBe('subscribe');
    expect(resolveCtaState('growth', 'growth')).toBe('current');
    expect(resolveCtaState('growth', 'scale')).toBe('upgrade');
    expect(resolveCtaState('scale', 'growth')).toBe('downgrade');
  });

  it('builds CTA labels from state', () => {
    expect(ctaLabel('upgrade', 'Scale')).toBe('Upgrade to Scale');
    expect(ctaLabel('current', 'Growth')).toBe('Current plan');
  });

  it('exposes yearly save percent from Growth SoT', () => {
    expect(billingSavePercentLabel()).toBe(PLAN_DEFINITIONS.growth.yearlySavePct);
    expect(billingSavePercentLabel()).toBeGreaterThan(0);
  });
});
