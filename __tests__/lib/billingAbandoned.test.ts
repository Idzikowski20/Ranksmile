/**
 * Minimal E2E-style unit checks for abandoned conversion guard + attempt UUID.
 * Full Stripe network E2E is gated in docs/stripe-event-matrix.md TEST GATE.
 */
import { shouldSendAbandonedForSubscription } from '../../lib/billingAbandoned';
import { isCheckoutAttemptId, newCheckoutAttemptId } from '../../lib/checkoutAttemptId';
import type Stripe from 'stripe';

describe('checkoutAttemptId', () => {
  it('accepts crypto UUIDs and rejects garbage', () => {
    const id = newCheckoutAttemptId();
    expect(isCheckoutAttemptId(id)).toBe(true);
    expect(isCheckoutAttemptId('not-a-uuid')).toBe(false);
  });
});

describe('shouldSendAbandonedForSubscription', () => {
  it('suppresses when a later active subscription exists', async () => {
    const stripe = {
      subscriptions: {
        list: jest.fn().mockResolvedValue({
          data: [
            { id: 'sub_B', created: 200, status: 'active', customer: 'cus_1' },
          ],
        }),
      },
    };
    const subA = {
      id: 'sub_A',
      status: 'incomplete_expired',
      created: 100,
      customer: 'cus_1',
    } as Stripe.Subscription;

    await expect(shouldSendAbandonedForSubscription(stripe as unknown as Stripe, subA)).resolves.toBe(false);
  });

  it('allows when no later conversion', async () => {
    const stripe = {
      subscriptions: {
        list: jest.fn().mockResolvedValue({ data: [] }),
      },
    };
    const subA = {
      id: 'sub_A',
      status: 'incomplete_expired',
      created: 100,
      customer: 'cus_1',
    } as Stripe.Subscription;

    await expect(shouldSendAbandonedForSubscription(stripe as unknown as Stripe, subA)).resolves.toBe(true);
  });

  it('suppresses when later sub was canceled after conversion', async () => {
    const stripe = {
      subscriptions: {
        list: jest.fn().mockResolvedValue({
          data: [
            {
              id: 'sub_B',
              created: 200,
              status: 'canceled',
              customer: 'cus_1',
              current_period_end: 999,
              trial_end: null,
            },
          ],
        }),
      },
    };
    const subA = {
      id: 'sub_A',
      status: 'incomplete_expired',
      created: 100,
      customer: 'cus_1',
    } as Stripe.Subscription;

    await expect(shouldSendAbandonedForSubscription(stripe as unknown as Stripe, subA)).resolves.toBe(false);
  });
});
