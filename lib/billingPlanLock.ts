import type { PlanSlug } from './stripePrices';

const LOCKED_CHECKOUT_STATUSES = new Set([
  'active',
  'trialing',
  'past_due',
  'unpaid',
]);

/** True when create-subscription / new Checkout must refuse (org already has a live paid/trial sub). */
export function blocksNewPaidCheckout(status: string | null | undefined): boolean {
  return status === 'active'
    || status === 'trialing'
    || status === 'past_due'
    || status === 'unpaid';
}

/**
 * Plan the org is already on and must not re-checkout.
 * Uses DB plan_slug only (never the quota default) so free/default orgs stay unlocked.
 */
export function getLockedCheckoutPlanSlug(
  billing: { planSlug?: PlanSlug | null; subscriptionStatus?: string | null } | null | undefined,
): PlanSlug | null {
  if (!billing?.planSlug) return null;
  if (!billing.subscriptionStatus || !LOCKED_CHECKOUT_STATUSES.has(billing.subscriptionStatus)) {
    return null;
  }
  return billing.planSlug;
}
