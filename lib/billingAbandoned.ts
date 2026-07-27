import type Stripe from 'stripe';

/**
 * True if customer had a later successful conversion after `afterUnix`
 * (reached active/trialing, or canceled after having a billing period / trial).
 */
export async function customerHadLaterSuccessfulConversion(
  stripe: Stripe,
  customerId: string,
  afterUnix: number,
): Promise<boolean> {
  const list = await stripe.subscriptions.list({
    customer: customerId,
    status: 'all',
    limit: 100,
  });
  for (const sub of list.data) {
    if (sub.created <= afterUnix) continue;
    if (sub.status === 'active' || sub.status === 'trialing') return true;
    if (sub.status === 'canceled') {
      const periodEnd = (sub as Stripe.Subscription & { current_period_end?: number }).current_period_end;
      if (periodEnd || sub.trial_end) return true;
    }
  }
  return false;
}

/** Whether this incomplete_expired sub should send abandoned email. */
export async function shouldSendAbandonedForSubscription(
  stripe: Stripe,
  subscription: Stripe.Subscription,
): Promise<boolean> {
  if (subscription.status !== 'incomplete_expired') return false;
  const customerId = typeof subscription.customer === 'string'
    ? subscription.customer
    : subscription.customer?.id;
  if (!customerId) return false;
  return !(await customerHadLaterSuccessfulConversion(stripe, customerId, subscription.created));
}
