import {
  getCheckoutPlan,
  getPlanCheckoutHref,
  getPlanPeriodPrice,
  getTrialEndDateLabel,
} from '../../lib/billingPlans';

describe('billingPlans', () => {
  it('builds checkout hrefs with billing period and checkout mode', () => {
    expect(getPlanCheckoutHref('Growth', 'yearly')).toBe('/billing/checkout/growth?billing=yearly&mode=trial');
    expect(getPlanCheckoutHref('Scale', 'monthly')).toBe('/billing/checkout/scale?billing=monthly&mode=upfront');
    expect(getPlanCheckoutHref('growth', 'yearly', 'upfront')).toBe('/billing/checkout/growth?billing=yearly&mode=upfront');
  });

  it('returns yearly totals from the plan yearly monthly price', () => {
    const growth = getCheckoutPlan('growth');

    expect(growth?.name).toBe('Growth');
    expect(getPlanPeriodPrice(growth!, 'yearly')).toBe(588);
    expect(getPlanPeriodPrice(growth!, 'monthly')).toBe(59);
  });

  it('formats the 7-day trial end label from a stable clock', () => {
    expect(getTrialEndDateLabel(new Date('2026-07-02T12:00:00Z'))).toBe('9 Jul');
  });
});
