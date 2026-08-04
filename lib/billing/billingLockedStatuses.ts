import type { SubscriptionStatus } from '../orgBilling';

/** Statuses that require at least one usable payment method. */
export const BILLING_PM_LOCKED_STATUSES: ReadonlySet<SubscriptionStatus> = new Set([
  'trialing',
  'active',
  'past_due',
  'unpaid',
]);

export function isPaymentMethodLockedStatus(status: SubscriptionStatus | null): boolean {
  return status != null && BILLING_PM_LOCKED_STATUSES.has(status);
}
