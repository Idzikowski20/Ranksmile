import { showsPlanExpired } from '@/src/infrastructure/appAccess/isPlanExpired';
import type { AccessSnapshot } from '@/src/infrastructure/appAccess/types';

/** A customer whose subscription lapsed: BILLING_REQUIRED with a billing history. */
const expired = {
  appState: 'BILLING_REQUIRED',
  billing: { everSubscribed: true },
} as unknown as AccessSnapshot;

/** Same state, no history — someone who simply has not picked a plan yet. */
const neverSubscribed = {
  appState: 'BILLING_REQUIRED',
  billing: { everSubscribed: false },
} as unknown as AccessSnapshot;

/**
 * The block replaced every non-public route, including the one its own CTA points at:
 * "Choose Growth" went to /plans, which rendered the block again. An expired customer
 * had no way to pay.
 */
describe('showsPlanExpired', () => {
  it.each([
    ['/plans', 'the CTA target'],
    ['/billing/checkout/growth', 'checkout'],
    ['/billing/confirmation/success', 'the return from Stripe'],
  ])('lets an expired account reach %s (%s)', (path) => {
    expect(showsPlanExpired(expired, path)).toBe(false);
  });

  it.each(['/articles', '/sites/example.pl', '/settings/billing_subscription'])(
    'still replaces the app at %s',
    (path) => {
      expect(showsPlanExpired(expired, path)).toBe(true);
    },
  );

  /** `/` is the Public landing route, which the shell excludes before reaching here. */
  it('leaves the public landing route alone', () => {
    expect(showsPlanExpired(expired, '/')).toBe(false);
  });

  /**
   * Telling someone who never had a plan that theirs expired would be a lie; they keep
   * the existing /plans redirect instead.
   */
  it('never fires for an account that never subscribed', () => {
    expect(showsPlanExpired(neverSubscribed, '/articles')).toBe(false);
  });

  it('leaves a payment failure to its own recovery flow', () => {
    const paymentFailed = {
      appState: 'PAYMENT_FAILED',
      billing: { everSubscribed: true },
    } as unknown as AccessSnapshot;
    expect(showsPlanExpired(paymentFailed, '/articles')).toBe(false);
  });
});
