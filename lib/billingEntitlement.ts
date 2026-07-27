import type { OrgBillingState, SubscriptionStatus } from './orgBilling';

export type BillingEntitlementProjection = Pick<
  OrgBillingState,
  'subscriptionStatus' | 'currentPeriodEnd' | 'cancelAtPeriodEnd'
>;

/**
 * Central entitlement contract (Stripe SoT projected locally).
 * past_due / unpaid keep access for recovery (v2.2 default).
 */
export function hasActiveBillingEntitlement(
  billing: BillingEntitlementProjection | null | undefined,
  now = new Date(),
): boolean {
  if (!billing?.subscriptionStatus) return false;
  const status = billing.subscriptionStatus;

  if (status === 'incomplete' || status === 'incomplete_expired' || status === 'canceled' || status === 'paused') {
    return false;
  }

  if (status === 'active' || status === 'trialing' || status === 'past_due' || status === 'unpaid') {
    if (billing.cancelAtPeriodEnd && billing.currentPeriodEnd) {
      const end = new Date(billing.currentPeriodEnd).getTime();
      if (!Number.isNaN(end) && end <= now.getTime()) return false;
    }
    return true;
  }

  return false;
}

export function isPaidLikeStatus(status: SubscriptionStatus | null | undefined): boolean {
  return status === 'active' || status === 'trialing';
}
