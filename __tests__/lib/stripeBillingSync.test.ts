import type Stripe from 'stripe';
import { syncSubscriptionToOrg } from '../../lib/stripeBillingSync';
import { getOrgBillingState, updateOrgBillingState, type OrgBillingState } from '../../lib/orgBilling';

jest.mock('../../lib/orgBilling', () => ({
  updateOrgBillingState: jest.fn(async () => undefined),
  getOrgBillingState: jest.fn(async () => null),
  isTerminalSubscriptionStatus: (status: string | null | undefined) => status === 'canceled' || status === 'incomplete_expired',
}));

jest.mock('../../lib/billingAudit', () => ({
  BillingSource: {
    CHECKOUT: 'CHECKOUT',
    ACTIVATE_TRIAL: 'ACTIVATE_TRIAL',
    WEBHOOK_SETUP: 'WEBHOOK_SETUP',
    WEBHOOK_SUB: 'WEBHOOK_SUB',
    RECONCILE: 'RECONCILE',
    UNKNOWN: 'UNKNOWN',
  },
  emitBillingEvent: jest.fn(async () => undefined),
  ensureCorrelationId: (id?: string | null) => (typeof id === 'string' && id.trim() ? id.trim() : 'corr-test'),
}));

jest.mock('../../lib/quota/ensureBalances', () => ({
  ensureOrgQuotaBalances: jest.fn(async () => undefined),
}));

jest.mock('../../lib/stripePrices', () => ({
  getPlanFromPriceId: jest.fn((priceId: string) => {
    if (priceId === 'price_scale_m') return { slug: 'scale', billing: 'monthly' };
    if (priceId === 'price_growth_m') return { slug: 'growth', billing: 'monthly' };
    return null;
  }),
}));

const mockUpdate = updateOrgBillingState as jest.MockedFunction<typeof updateOrgBillingState>;
const mockGetState = getOrgBillingState as jest.MockedFunction<typeof getOrgBillingState>;

function sub(partial: {
  status: Stripe.Subscription.Status;
  priceId?: string;
  planSlugMeta?: string;
  defaultPaymentMethod?: string | null;
}): Stripe.Subscription {
  return {
    id: 'sub_test',
    object: 'subscription',
    status: partial.status,
    cancel_at_period_end: false,
    trial_end: null,
    current_period_end: 1_800_000_000,
    default_payment_method: partial.defaultPaymentMethod === undefined
      ? null
      : partial.defaultPaymentMethod,
    metadata: {
      org_id: '1',
      plan_slug: partial.planSlugMeta ?? 'scale',
      billing_period: 'monthly',
    },
    items: {
      object: 'list',
      data: [
        {
          id: 'si_1',
          price: { id: partial.priceId ?? 'price_scale_m' },
        },
      ],
    },
  } as unknown as Stripe.Subscription;
}

describe('syncSubscriptionToOrg plan assignment', () => {
  beforeEach(() => {
    mockUpdate.mockClear();
    mockGetState.mockReset();
    mockGetState.mockResolvedValue(null);
  });

  it('does not write planSlug while subscription is incomplete (pre-payment)', async () => {
    await syncSubscriptionToOrg(1, sub({ status: 'incomplete' }));

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const patch = mockUpdate.mock.calls[0][1];
    expect(patch.subscriptionStatus).toBe('incomplete');
    expect(patch.planSlug).toBeNull();
    expect(patch.billingPeriod).toBeNull();
  });

  it('does not grant trial entitlements before SetupIntent attaches a payment method', async () => {
    // Stripe marks trial subs as trialing immediately; PM is still null until confirmSetup.
    await syncSubscriptionToOrg(1, sub({
      status: 'trialing',
      priceId: 'price_growth_m',
      planSlugMeta: 'growth',
      defaultPaymentMethod: null,
    }));

    const patch = mockUpdate.mock.calls[0][1];
    expect(patch.subscriptionStatus).toBe('incomplete');
    expect(patch.planSlug).toBeNull();
    expect(patch.billingPeriod).toBeNull();
  });

  it('writes planSlug when trialing has a default payment method', async () => {
    await syncSubscriptionToOrg(1, sub({
      status: 'trialing',
      priceId: 'price_growth_m',
      planSlugMeta: 'growth',
      defaultPaymentMethod: 'pm_card_visa',
    }));

    const patch = mockUpdate.mock.calls[0][1];
    expect(patch.planSlug).toBe('growth');
    expect(patch.billingPeriod).toBe('monthly');
    expect(patch.subscriptionStatus).toBe('trialing');
  });

  it('writes planSlug when subscription is active', async () => {
    await syncSubscriptionToOrg(1, sub({
      status: 'active',
      priceId: 'price_growth_m',
      planSlugMeta: 'growth',
    }));

    const patch = mockUpdate.mock.calls[0][1];
    expect(patch.planSlug).toBe('growth');
    expect(patch.subscriptionStatus).toBe('active');
  });

  it('resolves plan when Stripe returns price as an id string (unexpanded)', async () => {
    const s = sub({ status: 'active', priceId: 'price_scale_m', planSlugMeta: '' });
    (s.items.data[0] as { price: string }).price = 'price_scale_m';
    s.metadata.plan_slug = '';
    await syncSubscriptionToOrg(1, s);
    expect(mockUpdate.mock.calls[0][1].planSlug).toBe('scale');
  });

  it('does not patch planSlug to null when active but price/metadata cannot be mapped', async () => {
    const s = sub({
      status: 'active',
      priceId: 'price_unknown',
      planSlugMeta: '',
    });
    s.metadata.plan_slug = '';
    s.metadata.billing_period = '';
    await syncSubscriptionToOrg(1, s);
    const patch = mockUpdate.mock.calls[0][1];
    expect(patch.subscriptionStatus).toBe('active');
    expect(patch).not.toHaveProperty('planSlug');
    expect(patch).not.toHaveProperty('billingPeriod');
  });

  it('ignores a canceled webhook for a subscription the org no longer tracks', async () => {
    mockGetState.mockResolvedValueOnce({ stripeSubscriptionId: 'sub_current' } as OrgBillingState);

    await syncSubscriptionToOrg(1, sub({ status: 'canceled', priceId: 'price_growth_m' }));

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('applies a canceled webhook for the subscription the org tracks', async () => {
    mockGetState.mockResolvedValueOnce({ stripeSubscriptionId: 'sub_test' } as OrgBillingState);

    await syncSubscriptionToOrg(1, sub({ status: 'canceled', priceId: 'price_growth_m' }));

    const patch = mockUpdate.mock.calls[0][1];
    expect(patch.subscriptionStatus).toBe('canceled');
    expect(patch.planSlug).toBeNull();
  });

  it('ignores fallback slug while incomplete (upgrade pending payment)', async () => {
    await syncSubscriptionToOrg(
      1,
      sub({ status: 'incomplete', priceId: 'price_growth_m', planSlugMeta: 'agency' }),
      { slug: 'agency', billing: 'monthly' },
    );

    const patch = mockUpdate.mock.calls[0][1];
    expect(patch.planSlug).toBeNull();
  });
});
