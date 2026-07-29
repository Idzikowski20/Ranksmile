import {
  assertCanUpgradeSubscription,
  isAllowedSubscriptionChange,
  isPaidPlanUpgrade,
  planRank,
} from '../../lib/billingUpgrade';
import type { OrgBillingState } from '../../lib/orgBilling';

describe('billingUpgrade helpers', () => {
  it('ranks plans starter < growth < scale < agency', () => {
    expect(planRank('starter')).toBe(1);
    expect(planRank('growth')).toBe(2);
    expect(planRank('scale')).toBe(3);
    expect(planRank('agency')).toBe(4);
  });

  it('treats higher tier as upgrade even when switching yearly → monthly', () => {
    expect(isPaidPlanUpgrade('growth', 'yearly', 'scale', 'yearly')).toBe(true);
    expect(isPaidPlanUpgrade('growth', 'yearly', 'scale', 'monthly')).toBe(true);
    expect(isPaidPlanUpgrade('scale', 'yearly', 'growth', 'yearly')).toBe(false);
    expect(isPaidPlanUpgrade('growth', 'monthly', 'growth', 'yearly')).toBe(true);
  });

  it('allows same-tier billing period switches but not tier downgrades', () => {
    expect(isAllowedSubscriptionChange('scale', 'yearly', 'scale', 'monthly')).toBe(true);
    expect(isAllowedSubscriptionChange('scale', 'monthly', 'scale', 'yearly')).toBe(true);
    expect(isAllowedSubscriptionChange('growth', 'yearly', 'scale', 'monthly')).toBe(true);
    expect(isAllowedSubscriptionChange('scale', 'yearly', 'growth', 'monthly')).toBe(false);
    expect(isAllowedSubscriptionChange('scale', 'yearly', 'scale', 'yearly')).toBe(false);
  });

  it('assertCanUpgradeSubscription allows period switch and blocks tier downgrade', () => {
    const billing: OrgBillingState = {
      orgId: 1,
      stripeCustomerId: 'cus_x',
      stripeSubscriptionId: 'sub_x',
      planSlug: 'scale',
      billingPeriod: 'yearly',
      subscriptionStatus: 'active',
      trialEndsAt: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      lastCheckoutStartedAt: null,
      starterNudgeSentAt: null,
    };

    expect(assertCanUpgradeSubscription(billing, 'scale', 'monthly')).toEqual({
      ok: true,
      currentSlug: 'scale',
      currentBilling: 'yearly',
    });

    const same = assertCanUpgradeSubscription(billing, 'scale', 'yearly');
    expect(same.ok).toBe(false);
    if (!same.ok) expect(same.error).toMatch(/already on this plan/i);

    const down = assertCanUpgradeSubscription(billing, 'growth', 'yearly');
    expect(down.ok).toBe(false);
    if (!down.ok) expect(down.error).toMatch(/Downgrade/i);
  });
});
