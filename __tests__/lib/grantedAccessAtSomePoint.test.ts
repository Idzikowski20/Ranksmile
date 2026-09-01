import { grantedAccessAtSomePoint } from '@/src/infrastructure/billing/billingEverSubscribed';
import type { EverSubscribedInput } from '@/src/infrastructure/billing/billingEverSubscribed';

type Billing = Parameters<typeof grantedAccessAtSomePoint>[0];

const row = (over: Partial<EverSubscribedInput>): Billing => ({
  stripeSubscriptionId: null,
  subscriptionStatus: null,
  trialEndsAt: null,
  currentPeriodEnd: null,
  trialConsumedAt: null,
  ...over,
}) as Billing;

/**
 * `everSubscribed` is what separates "your plan expired" from "you have not picked one
 * yet" — both land in BILLING_REQUIRED. It counted the subscription id alone, and
 * create-subscription writes one with status `incomplete` the moment a checkout starts,
 * so abandoning a first checkout told a user who never paid that their plan had expired.
 */
describe('grantedAccessAtSomePoint', () => {
  it('says no for an abandoned first checkout', () => {
    // Exactly what pages/api/billing/create-subscription.ts writes before any payment.
    expect(grantedAccessAtSomePoint(row({
      stripeSubscriptionId: 'sub_123',
      subscriptionStatus: 'incomplete',
    }))).toBe(false);
  });

  it('says no once that attempt expires', () => {
    expect(grantedAccessAtSomePoint(row({
      stripeSubscriptionId: 'sub_123',
      subscriptionStatus: 'incomplete_expired',
    }))).toBe(false);
  });

  it.each(['active', 'trialing', 'past_due', 'unpaid', 'canceled'] as const)(
    'says yes for a subscription that reached %s',
    (subscriptionStatus) => {
      expect(grantedAccessAtSomePoint(row({
        stripeSubscriptionId: 'sub_123',
        subscriptionStatus,
      }))).toBe(true);
    },
  );

  it.each(['trialEndsAt', 'currentPeriodEnd', 'trialConsumedAt'] as const)(
    'says yes on %s alone once the attempt is past pre-payment',
    (field) => {
      expect(grantedAccessAtSomePoint(row({
        [field]: '2026-01-01T00:00:00.000Z',
        stripeSubscriptionId: 'sub_x',
        subscriptionStatus: 'active',
      }))).toBe(true);
    },
  );

  /**
   * stripeBillingSync writes currentPeriodEnd and trialEndsAt straight from Stripe with no
   * status check, and an `incomplete` subscription already carries a period on its
   * SubscriptionItem — so checking those dates before the status returned true for exactly
   * the abandoned checkout this excludes.
   */
  it.each(['trialEndsAt', 'currentPeriodEnd'] as const)(
    'ignores %s that the webhook wrote for an incomplete subscription',
    (field) => {
      expect(grantedAccessAtSomePoint(row({
        [field]: '2026-01-01T00:00:00.000Z',
        stripeSubscriptionId: 'sub_123',
        subscriptionStatus: 'incomplete',
      }))).toBe(false);
    },
  );

  /** A new checkout never overwrites it, so it still proves an earlier grant. */
  it('honours a consumed trial even while a new checkout is incomplete', () => {
    expect(grantedAccessAtSomePoint(row({
      trialConsumedAt: '2025-11-01T00:00:00.000Z',
      stripeSubscriptionId: 'sub_new',
      subscriptionStatus: 'incomplete',
    }))).toBe(true);
  });

  it.each([[null], [undefined]])('says no for %p', (billing) => {
    expect(grantedAccessAtSomePoint(billing)).toBe(false);
  });

  it('says no for an org that never reached Stripe at all', () => {
    expect(grantedAccessAtSomePoint(row({}))).toBe(false);
  });
});
