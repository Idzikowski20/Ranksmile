jest.mock('../../database/database', () => ({
  __esModule: true,
  default: { query: jest.fn(async () => [[], undefined]) },
}));

jest.mock('../../lib/orgBilling', () => ({
  getOrgBillingState: jest.fn(async () => null),
}));

jest.mock('../../lib/stripe', () => ({
  getStripe: jest.fn(),
  isStripeConfigured: jest.fn(() => false),
}));

jest.mock('../../lib/stripeBillingSync', () => ({
  syncSubscriptionToOrg: jest.fn(),
}));

import type Stripe from 'stripe';
import {
  formatConfirmationDateLabel,
  resolveNextBillingUnix,
  resolvePaymentMethodLabel,
} from '../../lib/billingConfirmation';

describe('formatConfirmationDateLabel', () => {
  it('formats unix trial_end (not “today” when trial is 7 days)', () => {
    const unix = Math.floor(Date.parse('2026-08-10T12:00:00.000Z') / 1000);
    expect(formatConfirmationDateLabel(unix)).toMatch(/August 10/);
    expect(formatConfirmationDateLabel('2026-08-10T12:00:00.000Z')).toMatch(/August 10/);
  });
});

describe('resolveNextBillingUnix', () => {
  it('does not use invoice.period_end alone when it equals today but line period is next month', () => {
    const today = Math.floor(Date.parse('2026-08-03T12:00:00.000Z') / 1000);
    const nextMonth = Math.floor(Date.parse('2026-09-03T12:00:00.000Z') / 1000);
    const invoice = {
      period_start: today,
      period_end: today,
      lines: {
        data: [{
          id: 'il_1',
          period: { start: today, end: nextMonth },
        }],
      },
    } as unknown as Stripe.Invoice;

    const unix = resolveNextBillingUnix({ isTrialing: false, invoice });
    expect(unix).toBe(nextMonth);
    expect(formatConfirmationDateLabel(unix)).toMatch(/September 3/);
  });

  it('prefers subscription item current_period_end over invoice periods', () => {
    const today = Math.floor(Date.parse('2026-08-03T12:00:00.000Z') / 1000);
    const nextMonth = Math.floor(Date.parse('2026-09-03T12:00:00.000Z') / 1000);
    const subscription = {
      items: { data: [{ current_period_end: nextMonth, current_period_start: today }] },
    } as unknown as Stripe.Subscription;
    const invoice = {
      period_end: today,
      lines: { data: [] },
    } as unknown as Stripe.Invoice;

    expect(resolveNextBillingUnix({ isTrialing: false, subscription, invoice })).toBe(nextMonth);
  });
});

describe('resolvePaymentMethodLabel', () => {
  it('reads card from subscription.default_payment_method when invoice PM is null', () => {
    const subscription = {
      default_payment_method: {
        id: 'pm_1',
        object: 'payment_method',
        card: { brand: 'visa', last4: '4242' },
      },
    } as unknown as Stripe.Subscription;
    const invoice = {
      default_payment_method: null,
    } as unknown as Stripe.Invoice;

    expect(resolvePaymentMethodLabel({ subscription, invoice })).toMatch(/VISA.*4242/i);
  });

  it('returns null when neither subscription nor invoice has an expanded card', () => {
    expect(resolvePaymentMethodLabel({
      subscription: { default_payment_method: 'pm_id_only' } as unknown as Stripe.Subscription,
      invoice: { default_payment_method: null } as unknown as Stripe.Invoice,
    })).toBeNull();
  });
});
