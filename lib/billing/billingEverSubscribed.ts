/**
 * Did Stripe ever actually grant this org access?
 *
 * `everSubscribed` is what separates "your plan expired" from "you have not picked one
 * yet" — both states land in BILLING_REQUIRED, and only the first should replace the app
 * with the expiry block. It counted `stripeSubscriptionId` on its own, but
 * `pages/api/billing/create-subscription.ts` writes that id with status `incomplete` the
 * moment a checkout starts, before any money moves. Abandoning a first checkout therefore
 * told a user who had never paid that their plan had expired.
 *
 * `hasActiveBillingEntitlement` already draws this line for access; this draws it for
 * history. Its own file because `lib/orgBilling` imports the database at module load,
 * which a unit test cannot.
 */
import type { OrgBillingState, SubscriptionStatus } from '../orgBilling';

/** Statuses under which the subscription never granted anything. */
const PRE_PAYMENT_STATUSES = new Set<SubscriptionStatus>(['incomplete', 'incomplete_expired']);

export type EverSubscribedInput = Pick<
  OrgBillingState,
  'stripeSubscriptionId' | 'subscriptionStatus' | 'trialEndsAt' | 'currentPeriodEnd' | 'trialConsumedAt'
>;

export function grantedAccessAtSomePoint(
  billing: EverSubscribedInput | null | undefined,
): boolean {
  if (!billing) return false;

  // The status gate comes FIRST. `stripeBillingSync` writes `currentPeriodEnd` and
  // `trialEndsAt` straight from the Stripe object with no status check, and an
  // `incomplete` subscription already carries a period on its SubscriptionItem — so a
  // date check placed ahead of this returned true for the abandoned checkout it was
  // written to exclude.
  if (PRE_PAYMENT_STATUSES.has(billing.subscriptionStatus as SubscriptionStatus)) {
    // Nothing THIS attempt wrote counts. `trialConsumedAt` is the one signal a new
    // checkout never overwrites, so it is what still proves an earlier grant.
    return Boolean(billing.trialConsumedAt);
  }

  // A trial that ran, a billing period that started, a trial already consumed: each is
  // proof on its own.
  if (billing.trialEndsAt || billing.currentPeriodEnd || billing.trialConsumedAt) return true;
  return Boolean(billing.stripeSubscriptionId);
}

export default grantedAccessAtSomePoint;
