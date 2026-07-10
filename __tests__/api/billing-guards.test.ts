jest.mock('../../utils/getUser', () => ({
  getCurrentUserId: jest.fn(),
  getCurrentUser: jest.fn(),
}));
jest.mock('../../lib/tenancy', () => ({ ensureUserTenancy: jest.fn() }));
jest.mock('../../lib/members', () => ({ assertCanManage: jest.fn() }));
jest.mock('../../lib/orgBilling', () => ({
  getOrgBillingState: jest.fn(),
  hasNonTerminalStripeSubscription: jest.fn((
    billing: { stripeSubscriptionId?: string | null; subscriptionStatus?: string | null } | null | undefined,
  ) => Boolean(
    billing?.stripeSubscriptionId
      && billing.subscriptionStatus !== 'canceled'
      && billing.subscriptionStatus !== 'incomplete_expired',
  )),
}));
jest.mock('../../lib/stripe', () => ({
  getStripe: jest.fn(),
  isStripeConfigured: jest.fn(),
}));
jest.mock('../../lib/stripeBillingSync', () => ({ syncSubscriptionToOrg: jest.fn() }));
jest.mock('../../lib/stripeCustomer', () => ({ ensureStripeCustomer: jest.fn() }));
jest.mock('../../lib/stripePrices', () => ({ getStripePriceId: jest.fn().mockReturnValue('price_growth') }));
jest.mock('../../lib/billingPlans', () => ({
  getCheckoutPlan: jest.fn().mockReturnValue({ slug: 'growth', name: 'Growth', priceMonthly: 59 }),
}));

import type { NextApiRequest, NextApiResponse } from 'next';
import cancelHandler from '../../pages/api/billing/cancel';
import checkoutSessionHandler from '../../pages/api/billing/checkout-session';
import createSubscriptionHandler from '../../pages/api/billing/create-subscription';
import portalHandler from '../../pages/api/billing/portal';
import updateCustomerHandler from '../../pages/api/billing/update-customer';
import { getCurrentUser, getCurrentUserId } from '../../utils/getUser';
import { ensureUserTenancy } from '../../lib/tenancy';
import { assertCanManage } from '../../lib/members';
import { getOrgBillingState } from '../../lib/orgBilling';
import { isStripeConfigured } from '../../lib/stripe';

type ApiHandler = (req: NextApiRequest, res: NextApiResponse) => Promise<unknown>;
type TestResponse = NextApiResponse & { statusCode?: number; body?: unknown };

const mockGetCurrentUserId = getCurrentUserId as jest.MockedFunction<typeof getCurrentUserId>;
const mockGetCurrentUser = getCurrentUser as jest.MockedFunction<typeof getCurrentUser>;
const mockEnsureUserTenancy = ensureUserTenancy as jest.MockedFunction<typeof ensureUserTenancy>;
const mockAssertCanManage = assertCanManage as jest.MockedFunction<typeof assertCanManage>;
const mockGetOrgBillingState = getOrgBillingState as jest.MockedFunction<typeof getOrgBillingState>;
const mockIsStripeConfigured = isStripeConfigured as jest.MockedFunction<typeof isStripeConfigured>;

const makeRes = (): TestResponse => {
  const res = {} as TestResponse;
  res.status = jest.fn((code: number) => {
    res.statusCode = code;
    return res;
  }) as NextApiResponse['status'];
  res.json = jest.fn((body: unknown) => {
    res.body = body;
    return res;
  }) as NextApiResponse['json'];
  res.setHeader = jest.fn() as NextApiResponse['setHeader'];
  return res;
};

const postReq = (body: Record<string, unknown> = {}): NextApiRequest => ({
  method: 'POST',
  body,
  query: {},
  cookies: {},
  headers: {},
} as NextApiRequest);

describe('billing mutation guards', () => {
  const originalPublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_test';
    mockGetCurrentUserId.mockResolvedValue('user-1');
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1', email: 'user@example.com' });
    mockEnsureUserTenancy.mockResolvedValue({ orgId: 7 });
    mockAssertCanManage.mockResolvedValue(undefined);
    mockGetOrgBillingState.mockResolvedValue(null);
    mockIsStripeConfigured.mockReturnValue(true);
  });

  afterAll(() => {
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = originalPublishableKey;
  });

  it.each<[string, ApiHandler, NextApiRequest]>([
    ['cancel', cancelHandler, postReq()],
    ['portal', portalHandler, postReq()],
    ['update-customer', updateCustomerHandler, postReq({ billingEmail: 'billing@example.com' })],
    ['checkout-session', checkoutSessionHandler, postReq({ planSlug: 'growth', billing: 'monthly', mode: 'trial' })],
    ['create-subscription', createSubscriptionHandler, postReq({ planSlug: 'growth', billing: 'monthly', mode: 'trial' })],
  ])('returns 403 for non-manager callers on %s', async (_name, handler, req) => {
    mockAssertCanManage.mockRejectedValueOnce(new Error('FORBIDDEN'));
    const res = makeRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.body).toEqual({ error: 'FORBIDDEN' });
  });

  it.each<[string, ApiHandler]>([
    ['checkout-session', checkoutSessionHandler],
    ['create-subscription', createSubscriptionHandler],
  ])('refuses to create duplicate Stripe subscriptions via %s', async (_name, handler) => {
    mockGetOrgBillingState.mockResolvedValueOnce({
      orgId: 7,
      stripeCustomerId: 'cus_123',
      stripeSubscriptionId: 'sub_123',
      planSlug: 'growth',
      billingPeriod: 'monthly',
      subscriptionStatus: 'active',
      trialEndsAt: null,
      currentPeriodEnd: null,
    });
    const res = makeRes();

    await handler(postReq({ planSlug: 'growth', billing: 'monthly', mode: 'trial' }), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.body).toEqual({ error: 'An active Stripe subscription already exists for this organization' });
  });
});
