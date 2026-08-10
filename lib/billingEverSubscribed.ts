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
import type { OrgBillingState, SubscriptionStatus } from './orgBilling';

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
  // A trial that ran, a billing period that started, a trial already consumed: each is
  // proof on its own, whatever a later checkout attempt happens to be doing now.
  if (billing.trialEndsAt || billing.currentPeriodEnd || billing.trialConsumedAt) return true;
  if (!billing.stripeSubscriptionId) return false;
  return !PRE_PAYMENT_STATUSES.has(billing.subscriptionStatus as SubscriptionStatus);
}

export default grantedAccessAtSomePoint;
