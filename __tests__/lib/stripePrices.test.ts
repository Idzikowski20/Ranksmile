import { getStripePriceId, getPlanFromPriceId } from '../../lib/stripePrices';

describe('stripePrices', () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
    process.env.STRIPE_PRICE_GROWTH_MONTHLY = 'price_growth_m';
    process.env.STRIPE_PRICE_GROWTH_YEARLY = 'price_growth_y';
    process.env.STRIPE_PRICE_STARTER_MONTHLY = '';
    process.env.STRIPE_PRICE_STARTER_YEARLY = '';
    process.env.STRIPE_PRICE_SCALE_MONTHLY = '';
    process.env.STRIPE_PRICE_SCALE_YEARLY = '';
    process.env.STRIPE_PRICE_AGENCY_MONTHLY = '';
    process.env.STRIPE_PRICE_AGENCY_YEARLY = '';
  });

  afterAll(() => {
    process.env = env;
  });

  it('reads configured price ids from env', () => {
    expect(getStripePriceId('growth', 'monthly')).toBe('price_growth_m');
    expect(getStripePriceId('growth', 'yearly')).toBe('price_growth_y');
    expect(getStripePriceId('starter', 'monthly')).toBeNull();
  });

  it('reverse-maps a Stripe price id to plan + billing period', () => {
    expect(getPlanFromPriceId('price_growth_y')).toEqual({ slug: 'growth', billing: 'yearly' });
    expect(getPlanFromPriceId('price_unknown')).toBeNull();
  });
});
