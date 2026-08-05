import type Stripe from 'stripe';
import {
  applySubscriptionUpgrade,
  assertCanUpgradeSubscription,
  isAllowedSubscriptionChange,
  isPaidPlanUpgrade,
  planRank,
} from '../../lib/billingUpgrade';
import type { OrgBillingState } from '../../lib/orgBilling';

describe('billingUpgrade helpers', () => {
  it('ranks plans starter < growth < scale < agency', () => {
    expect(planRank('starter')).toBe(0);
    expect(planRank('growth')).toBe(1);
    expect(planRank('scale')).toBe(2);
    expect(planRank('agency')).toBe(3);
  });

  it('treats higher tier as upgrade even when switching yearly → monthly', () => {
    expect(isPaidPlanUpgrade('growth', 'yearly', 'scale', 'yearly')).toBe(true);
    expect(isPaidPlanUpgrade('growth', 'yearly', 'scale', 'monthly')).toBe(true);
    expect(isPaidPlanUpgrade('scale', 'yearly', 'growth', 'yearly')).toBe(false);
    expect(isPaidPlanUpgrade('growth', 'monthly', 'growth', 'yearly')).toBe(true);
  });

  it('allows same-tier billing period switches but not tier downgrades', () => {
    expect(isAllowedSubscriptionChange('starter', 'monthly', 'growth', 'monthly')).toBe(true);
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
    trialConsumedAt: null,
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

describe('applySubscriptionUpgrade pending updates', () => {
  const baseSub = {
    id: 'sub_x',
    metadata: {},
    cancel_at_period_end: false,
    items: { data: [{ id: 'si_1' }] },
    latest_invoice: null,
  };

  function mockStripe(sub: typeof baseSub) {
    const retrieve = jest.fn().mockResolvedValue(sub);
    const update = jest.fn().mockImplementation(async (_id: string, params: Record<string, unknown>) => ({
      ...sub,
      ...params,
      cancel_at_period_end: params.cancel_at_period_end ?? sub.cancel_at_period_end,
      latest_invoice: null,
    }));
    return { subscriptions: { retrieve, update } } as unknown as Stripe;
  }

  const args = {
    orgId: 1,
    userId: 'u1',
    subscriptionId: 'sub_x',
    targetPriceId: 'price_growth',
    targetSlug: 'growth' as const,
    targetBilling: 'monthly' as const,
  };

  it('does not send cancel_at_period_end with pending_if_incomplete', async () => {
    const stripe = mockStripe(baseSub);
    await applySubscriptionUpgrade(stripe, args);

    const pendingCall = (stripe.subscriptions.update as jest.Mock).mock.calls.find(
      (c) => c[1]?.payment_behavior === 'pending_if_incomplete',
    );
    expect(pendingCall).toBeDefined();
    expect(pendingCall![1]).not.toHaveProperty('cancel_at_period_end');
  });

  it('clears scheduled cancel in a separate update before pending upgrade', async () => {
    const stripe = mockStripe({ ...baseSub, cancel_at_period_end: true });
    await applySubscriptionUpgrade(stripe, args);

    const calls = (stripe.subscriptions.update as jest.Mock).mock.calls;
    expect(calls.length).toBeGreaterThanOrEqual(2);
    expect(calls[0][1]).toEqual({ cancel_at_period_end: false });
    expect(calls[1][1].payment_behavior).toBe('pending_if_incomplete');
    expect(calls[1][1]).not.toHaveProperty('cancel_at_period_end');
  });
});
