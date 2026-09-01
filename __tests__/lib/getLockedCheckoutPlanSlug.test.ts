import { getLockedCheckoutPlanSlug, blocksNewPaidCheckout } from '../../lib/billingPlanLock';

describe('getLockedCheckoutPlanSlug', () => {
  it('returns null when there is no plan_slug in billing', () => {
    expect(getLockedCheckoutPlanSlug({
      planSlug: null,
      subscriptionStatus: 'active',
    })).toBeNull();
  });

  it('returns null for terminal / incomplete statuses', () => {
    expect(getLockedCheckoutPlanSlug({
      planSlug: 'growth',
      subscriptionStatus: 'canceled',
    })).toBeNull();
    expect(getLockedCheckoutPlanSlug({
      planSlug: 'growth',
      subscriptionStatus: 'incomplete',
    })).toBeNull();
  });

  it('locks active and trialing plans', () => {
    expect(getLockedCheckoutPlanSlug({
      planSlug: 'scale',
      subscriptionStatus: 'active',
    })).toBe('scale');
    expect(getLockedCheckoutPlanSlug({
      planSlug: 'starter',
      subscriptionStatus: 'trialing',
    })).toBe('starter');
  });
});

describe('blocksNewPaidCheckout', () => {
  it('blocks live subscription statuses used by create-subscription', () => {
    expect(blocksNewPaidCheckout('active')).toBe(true);
    expect(blocksNewPaidCheckout('trialing')).toBe(true);
    expect(blocksNewPaidCheckout('past_due')).toBe(true);
    expect(blocksNewPaidCheckout('unpaid')).toBe(true);
  });

  it('allows first checkout when there is no live subscription', () => {
    expect(blocksNewPaidCheckout(null)).toBe(false);
    expect(blocksNewPaidCheckout('canceled')).toBe(false);
    expect(blocksNewPaidCheckout('incomplete')).toBe(false);
  });
});
