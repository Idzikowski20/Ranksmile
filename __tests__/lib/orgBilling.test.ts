import { hasNonTerminalStripeSubscription, type OrgBillingState } from '../../lib/orgBilling';

const billing = (
  subscriptionStatus: OrgBillingState['subscriptionStatus'],
  stripeSubscriptionId: string | null = 'sub_123',
): Pick<OrgBillingState, 'stripeSubscriptionId' | 'subscriptionStatus'> => ({
  stripeSubscriptionId,
  subscriptionStatus,
});

describe('hasNonTerminalStripeSubscription', () => {
  it('blocks existing active-like Stripe subscriptions', () => {
    expect(hasNonTerminalStripeSubscription(billing('active'))).toBe(true);
    expect(hasNonTerminalStripeSubscription(billing('trialing'))).toBe(true);
    expect(hasNonTerminalStripeSubscription(billing('incomplete'))).toBe(true);
  });

  it('allows terminal or missing Stripe subscriptions', () => {
    expect(hasNonTerminalStripeSubscription(billing('canceled'))).toBe(false);
    expect(hasNonTerminalStripeSubscription(billing('incomplete_expired'))).toBe(false);
    expect(hasNonTerminalStripeSubscription(billing(null, null))).toBe(false);
  });
});
