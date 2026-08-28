import { allowsFrontend } from '@/src/infrastructure/appAccess/accessPolicy';
import type { AccessSnapshot } from '@/src/infrastructure/appAccess/types';

/**
 * Should the app be replaced by the "your plan has expired" block?
 *
 * Not `LOCKED`: that state is unreachable. The only route to it is `hardLocked`,
 * which nothing in the codebase ever sets — getBootstrap calls
 * projectBillingState without it, and buildAccessSnapshot only forwards what it
 * is not given. A gate on LOCKED would never fire.
 *
 * A lapsed trial or subscription lands in BILLING_REQUIRED, which also holds
 * every account that simply has not picked a plan yet. `everSubscribed`
 * separates them: telling a brand-new user their plan expired would be a lie, so
 * they keep the existing /plans redirect.
 *
 * PAYMENT_FAILED is left alone — that is a card problem with its own recovery
 * flow, not an expiry.
 */
export function isPlanExpired(access: AccessSnapshot): boolean {
  return access.appState === 'BILLING_REQUIRED' && access.billing.everSubscribed === true;
}

export default isPlanExpired;

/**
 * Should THIS route be replaced by the expiry block?
 *
 * Replacing every non-public route left an expired customer no way to pay: the block's own
 * "Choose Growth" link goes to /plans, which rendered the block again. The billing policy
 * already grants BILLING_REQUIRED the whole renewal path — /plans, /billing/checkout/:plan,
 * /billing/confirmation/success — so the block only has to stop overriding it.
 */
export function showsPlanExpired(access: AccessSnapshot, path: string): boolean {
  return isPlanExpired(access) && !allowsFrontend(access.appState, path);
}
