import {
  nextPlan,
  previousPlan,
  resolveCtaState,
  ctaLabel,
  billingSavePercentLabel,
  PLAN_DEFINITIONS,
} from '../../../lib/pricing/planDefinition';

describe('planDefinition hierarchy + CTA', () => {
  it('resolves previous / next along PlanHierarchy (Starter retired)', () => {
    expect(previousPlan('growth')).toBeNull();
    expect(nextPlan('growth')).toBe('scale');
    expect(previousPlan('scale')).toBe('growth');
    expect(nextPlan('agency')).toBeNull();
  });

  it('maps CTA states from current vs target rank', () => {
    expect(resolveCtaState(null, 'growth')).toBe('subscribe');
    expect(resolveCtaState('growth', 'growth')).toBe('current');
    expect(resolveCtaState('growth', 'scale')).toBe('upgrade');
    expect(resolveCtaState('scale', 'growth')).toBe('downgrade');
    expect(resolveCtaState('starter', 'growth')).toBe('upgrade');
  });

  it('builds CTA labels from state', () => {
    expect(ctaLabel('subscribe', 'Growth', { planSlug: 'growth', trialEligible: true }))
      .toBe('Get 7 days free trial');
    expect(ctaLabel('subscribe', 'Growth', { planSlug: 'growth', trialEligible: false }))
      .toBe('Start Growth');
    expect(ctaLabel('subscribe', 'Scale', { planSlug: 'scale' })).toBe('Start Scale');
    expect(ctaLabel('upgrade', 'Scale')).toBe('Upgrade to Scale');
    expect(ctaLabel('current', 'Growth')).toBe('Current plan');
  });

  it('exposes yearly save percent from Growth SoT', () => {
    expect(billingSavePercentLabel()).toBe(PLAN_DEFINITIONS.growth.yearlySavePct);
    expect(billingSavePercentLabel()).toBeGreaterThan(0);
  });
});
