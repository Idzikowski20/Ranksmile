import { hasActiveBillingEntitlement } from '@/src/infrastructure/billing/billingEntitlement';

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

  // The projection mirrors Stripe, and Stripe flips `trialing` at trial end — but only
  // through a webhook. When the webhook never lands (dev, misconfigured endpoint, lost
  // event) the row says `trialing` forever and an expired trial keeps full access.
  // The local date is the backstop.
  describe('expired trial', () => {
    it('revokes a trial whose end passed beyond the grace window', () => {
      expect(hasActiveBillingEntitlement({
        subscriptionStatus: 'trialing',
        trialEndsAt: '2026-07-27T09:00:00Z', // 3h before `now`
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      }, now)).toBe(false);
    });

    it('keeps a trial inside the grace window, so the Stripe webhook wins the race', () => {
      expect(hasActiveBillingEntitlement({
        subscriptionStatus: 'trialing',
        trialEndsAt: '2026-07-27T11:30:00Z', // 30min before `now`
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      }, now)).toBe(true);
    });

    it('keeps a trial with no recorded end date — Stripe stays the authority', () => {
      expect(hasActiveBillingEntitlement({
        subscriptionStatus: 'trialing',
        trialEndsAt: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      }, now)).toBe(true);
    });

    it('does not touch an active subscription, whatever the old trial date says', () => {
      expect(hasActiveBillingEntitlement({
        subscriptionStatus: 'active',
        trialEndsAt: '2026-01-01T00:00:00Z',
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      }, now)).toBe(true);
    });
  });
});
