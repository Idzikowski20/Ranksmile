import { detectStripeKeyMode, stripeModeMismatchError } from '../../lib/stripeMode';

describe('stripeMode', () => {
  const prevKey = process.env.STRIPE_SECRET_KEY;
  const prevMode = process.env.STRIPE_MODE;

  afterEach(() => {
    if (prevKey === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = prevKey;
    if (prevMode === undefined) delete process.env.STRIPE_MODE;
    else process.env.STRIPE_MODE = prevMode;
  });

  it('detects test and live prefixes', () => {
    expect(detectStripeKeyMode('sk_test_abc')).toBe('test');
    expect(detectStripeKeyMode('sk_live_abc')).toBe('live');
  });

  it('flags mode mismatch', () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_x';
    process.env.STRIPE_MODE = 'live';
    expect(stripeModeMismatchError()).toMatch(/STRIPE_MODE=live/);
  });

  it('ok when mode matches', () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_x';
    process.env.STRIPE_MODE = 'test';
    expect(stripeModeMismatchError()).toBeNull();
  });
});
