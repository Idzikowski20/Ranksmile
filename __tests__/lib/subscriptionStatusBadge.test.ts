import { resolveSubscriptionBadge } from '../../components/settings/SubscriptionStatusBadge';
import type { SubscriptionDetails } from '../../lib/subscriptionDetails';

function sub(partial: Partial<SubscriptionDetails>): SubscriptionDetails {
  return {
    configured: true,
    hasStripeSubscription: false,
    planSlug: 'growth',
    lockedPlanSlug: null,
    planName: 'Growth',
    billingPeriod: 'monthly',
    subscriptionStatus: null,
    paymentFailedLocked: false,
    paymentFailedLockedAt: null,
    trialEndsAt: null,
    trialEndsAtLabel: null,
    currentPeriodEnd: null,
    currentPeriodEndLabel: null,
    cancelAtPeriodEnd: false,
    periodLabel: null,
    upcoming: null,
    isTrialing: false,
    ...partial,
  };
}

describe('resolveSubscriptionBadge', () => {
  it('maps paid / unpaid / failed / trial', () => {
    expect(resolveSubscriptionBadge(null).label).toBe('Not acquired');
    expect(resolveSubscriptionBadge(sub({ hasStripeSubscription: true, subscriptionStatus: 'active' })).label).toBe('Paid');
    expect(resolveSubscriptionBadge(sub({ isTrialing: true, hasStripeSubscription: true, subscriptionStatus: 'trialing' })).label).toBe('Trial');
    expect(resolveSubscriptionBadge(sub({ paymentFailedLocked: true, hasStripeSubscription: true, subscriptionStatus: 'past_due' })).label).toBe('Payment failed');
    expect(resolveSubscriptionBadge(sub({ cancelAtPeriodEnd: true, hasStripeSubscription: true, subscriptionStatus: 'active' })).label).toBe('Cancels soon');
  });
});
