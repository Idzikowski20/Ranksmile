import type { OrgBillingState } from '../../lib/orgBilling';
import type { BillingPeriod } from '../../lib/billingPlans';
import type { PlanSlug } from '../../lib/stripePrices';
import {
  isApiRouteAllowedDuringPaymentLock,
  isFrontendRouteAllowedDuringPaymentLock,
  isPaymentFailedLocked,
} from '../../lib/paymentFailedLock';

function makeBillingState(overrides: Partial<OrgBillingState> = {}): OrgBillingState {
  const billingPeriod: BillingPeriod = 'monthly';
  const planSlug: PlanSlug = 'growth';

  return {
    orgId: 1,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    planSlug,
    billingPeriod,
    subscriptionStatus: 'active',
    trialEndsAt: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    lastCheckoutStartedAt: null,
    starterNudgeSentAt: null,
    paymentFailedLockedAt: null,
    paymentFailedInvoiceId: null,
    paymentFailedSubscriptionId: null,
    paymentFailedCustomerId: null,
    paymentLockLastEventCreatedAt: null,
    paymentLockLastEventId: null,
    ...overrides,
  };
}

describe('isPaymentFailedLocked', () => {
  it('returns false for null/undefined billing', () => {
    expect(isPaymentFailedLocked(null)).toBe(false);
    expect(isPaymentFailedLocked(undefined)).toBe(false);
  });

  it('returns true when paymentFailedLockedAt is set', () => {
    expect(isPaymentFailedLocked(makeBillingState({
      paymentFailedLockedAt: '2026-07-29T10:00:00.000Z',
    }))).toBe(true);
  });

  it('returns false when paymentFailedLockedAt is null', () => {
    expect(isPaymentFailedLocked(makeBillingState({ paymentFailedLockedAt: null }))).toBe(false);
  });
});

describe('frontend route allowlist', () => {
  it('allows /plans (including query params)', () => {
    expect(isFrontendRouteAllowedDuringPaymentLock('/plans?reason=payment_failed')).toBe(true);
  });

  it('allows checkout routes', () => {
    expect(isFrontendRouteAllowedDuringPaymentLock('/billing/checkout/growth?billing=yearly')).toBe(true);
  });

  it('allows billing subscription settings', () => {
    expect(isFrontendRouteAllowedDuringPaymentLock('/settings/billing_subscription')).toBe(true);
  });

  it('allows billing confirmation routes', () => {
    expect(isFrontendRouteAllowedDuringPaymentLock('/billing/confirmation/failed')).toBe(true);
    expect(isFrontendRouteAllowedDuringPaymentLock('/billing/confirmation/success')).toBe(true);
  });

  it('defaults to deny for unknown routes', () => {
    expect(isFrontendRouteAllowedDuringPaymentLock('/dashboard')).toBe(false);
    expect(isFrontendRouteAllowedDuringPaymentLock('/workspace/123')).toBe(false);
    expect(isFrontendRouteAllowedDuringPaymentLock('/billing/portal')).toBe(false);
  });
});

describe('API route allowlist', () => {
  it('allows billing recovery endpoints', () => {
    expect(isApiRouteAllowedDuringPaymentLock('GET:/api/billing/subscription')).toBe(true);
    expect(isApiRouteAllowedDuringPaymentLock('GET:/api/billing/status')).toBe(true);
    expect(isApiRouteAllowedDuringPaymentLock('GET:/api/billing/plan-summary')).toBe(true);
    expect(isApiRouteAllowedDuringPaymentLock('GET:/api/billing/invoices')).toBe(true);
    expect(isApiRouteAllowedDuringPaymentLock('GET:/api/billing/confirmation')).toBe(true);
    expect(isApiRouteAllowedDuringPaymentLock('POST:/api/billing/checkout-session')).toBe(true);
    expect(isApiRouteAllowedDuringPaymentLock('POST:/api/billing/upgrade-subscription')).toBe(true);
    expect(isApiRouteAllowedDuringPaymentLock('POST:/api/billing/portal')).toBe(true);
    expect(isApiRouteAllowedDuringPaymentLock('POST:/api/billing/upgrade-preview')).toBe(true);
    expect(isApiRouteAllowedDuringPaymentLock('POST:/api/billing/cancel')).toBe(true);
    expect(isApiRouteAllowedDuringPaymentLock('POST:/api/billing/update-customer')).toBe(true);
  });

  it('allows essential session endpoints used by guards', () => {
    expect(isApiRouteAllowedDuringPaymentLock('GET:/api/session/bootstrap')).toBe(true);
    expect(isApiRouteAllowedDuringPaymentLock('GET:/api/health')).toBe(true);
    expect(isApiRouteAllowedDuringPaymentLock('GET:/api/ready')).toBe(true);
  });

  it('defaults to deny for unknown method/path', () => {
    expect(isApiRouteAllowedDuringPaymentLock('GET:/api/inbox')).toBe(false);
    expect(isApiRouteAllowedDuringPaymentLock('PUT:/api/billing/subscription')).toBe(false);
    expect(isApiRouteAllowedDuringPaymentLock('POST:/api/billing/portal?x=1')).toBe(true);
  });

  it('defaults to deny when method is missing', () => {
    expect(isApiRouteAllowedDuringPaymentLock('/api/billing/subscription')).toBe(false);
  });
});
