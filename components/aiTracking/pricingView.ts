import { SIGN_UP_HREF } from './content';

/**
 * The two bits of pricing logic the AiPricing view derives itself (everything else
 * comes from the billing source of truth in lib/pricing). Kept pure and separate so
 * the signup deep-link and the yearly-saving headline are regression-tested.
 */

/** Signup deep-link carrying the chosen plan + billing period. */
export function planHref(slug: string, yearly: boolean): string {
  return `${SIGN_UP_HREF}?plan=${slug}&billing=${yearly ? 'yearly' : 'monthly'}`;
}

/** Annual saving vs paying the monthly price for 12 months. */
export function yearlySaving(monthly: number, yearlyPrice: number): number {
  return (monthly - yearlyPrice) * 12;
}
