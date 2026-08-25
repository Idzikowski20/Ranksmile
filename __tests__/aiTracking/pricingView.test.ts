import { planHref, yearlySaving } from '../../components/aiTracking/pricingView';

describe('AiPricing derived values', () => {
  it('builds a signup deep-link carrying plan slug and billing period', () => {
    expect(planHref('scale', true)).toBe('/auth/sign-up?plan=scale&billing=yearly');
    expect(planHref('scale', false)).toBe('/auth/sign-up?plan=scale&billing=monthly');
  });

  it('computes the annual saving vs 12 monthly payments', () => {
    expect(yearlySaving(100, 80)).toBe(240);
    expect(yearlySaving(80, 80)).toBe(0);
  });
});
