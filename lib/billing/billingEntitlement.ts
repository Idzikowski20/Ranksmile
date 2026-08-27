import type { OrgBillingState, SubscriptionStatus } from '../orgBilling';

// trialEndsAt is required, not optional: an omitted date reads as "no end recorded",
// which silently re-opens the forever-trial hole at whichever call site forgot it.
export type BillingEntitlementProjection = Pick<
  OrgBillingState,
  'subscriptionStatus' | 'currentPeriodEnd' | 'cancelAtPeriodEnd' | 'trialEndsAt'
>;

/**
 * How long past `trial_ends_at` a `trialing` row keeps access. At trial end Stripe
 * charges the stored card and flips the status itself — active when it succeeds,
 * past_due when it does not, both of which keep access — so for a healthy webhook this
 * grace is never observed. It exists so a paying customer is not flashed the expiry
 * block in the minutes between our clock passing the date and the webhook landing.
 */
const TRIAL_EXPIRY_GRACE_MS = 60 * 60_000;

/**
 * Central entitlement contract (Stripe SoT projected locally).
 * past_due / unpaid keep access for recovery (v2.2 default).
 *
 * `trialing` is additionally gated on `trialEndsAt`: the status only changes when a
 * Stripe webhook says so, and when no webhook ever lands (dev without a forwarder, a
 * misconfigured endpoint, a lost event) the row says `trialing` forever — which kept an
 * expired trial fully entitled, indefinitely. The local date is the backstop. A missing
 * date changes nothing: Stripe stays the authority.
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

  if (status === 'trialing' && billing.trialEndsAt) {
    const end = new Date(billing.trialEndsAt).getTime();
    if (!Number.isNaN(end) && end + TRIAL_EXPIRY_GRACE_MS <= now.getTime()) return false;
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
