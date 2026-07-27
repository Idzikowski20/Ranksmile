import { hasActiveBillingEntitlement } from '../../lib/billingEntitlement';

describe('hasActiveBillingEntitlement', () => {
  const now = new Date('2026-07-27T12:00:00Z');

  it('allows active and trialing', () => {
    expect(hasActiveBillingEntitlement({
      subscriptionStatus: 'active',
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    }, now)).toBe(true);
    expect(hasActiveBillingEntitlement({
      subscriptionStatus: 'trialing',
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    }, now)).toBe(true);
  });

  it('keeps access for cancel_at_period_end before period end', () => {
    expect(hasActiveBillingEntitlement({
      subscriptionStatus: 'active',
      cancelAtPeriodEnd: true,
      currentPeriodEnd: '2026-08-27T00:00:00Z',
    }, now)).toBe(true);
  });

  it('revokes after period end when cancel_at_period_end', () => {
    expect(hasActiveBillingEntitlement({
      subscriptionStatus: 'active',
      cancelAtPeriodEnd: true,
      currentPeriodEnd: '2026-07-01T00:00:00Z',
    }, now)).toBe(false);
  });

  it('denies incomplete and canceled', () => {
    expect(hasActiveBillingEntitlement({
      subscriptionStatus: 'incomplete',
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    }, now)).toBe(false);
    expect(hasActiveBillingEntitlement({
      subscriptionStatus: 'canceled',
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    }, now)).toBe(false);
  });

  it('allows past_due for recovery', () => {
    expect(hasActiveBillingEntitlement({
      subscriptionStatus: 'past_due',
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    }, now)).toBe(true);
  });
});
