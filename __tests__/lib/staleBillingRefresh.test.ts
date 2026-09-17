import type Stripe from 'stripe';
import { getOrgBillingStateFresh } from '@/src/infrastructure/billing/stripeBillingReconcile';
import { getOrgBillingState, updateOrgBillingState, type OrgBillingState } from '@/src/infrastructure/billing/orgBilling';
import { syncSubscriptionToOrg } from '@/src/infrastructure/billing/stripeBillingSync';

jest.mock('@/database/database', () => ({ __esModule: true, default: { query: jest.fn() } }));
jest.mock('@/src/infrastructure/persistence/schema/ensureBillingTables', () => ({
  ensureBillingTables: jest.fn(async () => undefined),
}));
jest.mock('@/src/infrastructure/billing/orgBilling', () => ({
  getOrgBillingState: jest.fn(),
  getOrgIdByStripeCustomerId: jest.fn(),
  updateOrgBillingState: jest.fn(async () => undefined),
}));
jest.mock('@/src/infrastructure/billing/stripeBillingSync', () => ({
  syncSubscriptionToOrg: jest.fn(async () => undefined),
  orgIdFromMetadata: jest.fn(),
}));
const mockRetrieve = jest.fn();
jest.mock('@/src/infrastructure/billing/stripe', () => ({
  isStripeConfigured: () => true,
  getStripe: () => ({ subscriptions: { retrieve: mockRetrieve } }),
}));

const mockGet = getOrgBillingState as jest.MockedFunction<typeof getOrgBillingState>;
const mockSync = syncSubscriptionToOrg as jest.MockedFunction<typeof syncSubscriptionToOrg>;
const mockUpdate = updateOrgBillingState as jest.MockedFunction<typeof updateOrgBillingState>;

const NOW = new Date('2026-09-17T08:00:00Z');

function state(partial: Partial<OrgBillingState>): OrgBillingState {
  return {
    orgId: 1,
    stripeCustomerId: 'cus_1',
    stripeSubscriptionId: 'sub_1',
    planSlug: 'growth',
    billingPeriod: 'monthly',
    subscriptionStatus: 'active',
    trialEndsAt: null,
    trialConsumedAt: null,
    currentPeriodEnd: '2026-10-15T17:01:12.000Z',
    cancelAtPeriodEnd: false,
    lastCheckoutStartedAt: null,
    starterNudgeSentAt: null,
    paymentFailedLockedAt: null,
    paymentFailedInvoiceId: null,
    paymentFailedSubscriptionId: null,
    paymentFailedCustomerId: null,
    paymentLockLastEventCreatedAt: null,
    paymentLockLastEventId: null,
    ...partial,
  };
}

describe('getOrgBillingStateFresh', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(NOW);
  });
  afterEach(() => jest.useRealTimers());

  it('does not call Stripe while the paid period is still running', async () => {
    mockGet.mockResolvedValue(state({}));
    await getOrgBillingStateFresh(1);
    expect(mockRetrieve).not.toHaveBeenCalled();
  });

  it('re-syncs an active row whose period ended (lost renewal webhook) and returns the fresh row', async () => {
    const stale = state({ orgId: 2, currentPeriodEnd: '2026-09-15T17:01:12.000Z' });
    const fresh = state({ orgId: 2 });
    mockGet.mockResolvedValueOnce(stale).mockResolvedValueOnce(fresh);
    const sub = { id: 'sub_1', status: 'active' } as Stripe.Subscription;
    mockRetrieve.mockResolvedValue(sub);

    await expect(getOrgBillingStateFresh(2)).resolves.toBe(fresh);
    expect(mockRetrieve).toHaveBeenCalledWith('sub_1');
    expect(mockSync).toHaveBeenCalledWith(2, sub, undefined, expect.objectContaining({ source: 'RECONCILE' }));
  });

  it('throttles repeat refreshes for the same org', async () => {
    mockGet.mockResolvedValue(state({ orgId: 3, currentPeriodEnd: '2026-09-15T17:01:12.000Z' }));
    mockRetrieve.mockResolvedValue({ id: 'sub_1', status: 'active' });
    await getOrgBillingStateFresh(3);
    await getOrgBillingStateFresh(3);
    expect(mockRetrieve).toHaveBeenCalledTimes(1);
  });

  it('marks the org canceled when Stripe no longer has the subscription', async () => {
    mockGet.mockResolvedValue(state({ orgId: 4, currentPeriodEnd: '2026-09-15T17:01:12.000Z' }));
    mockRetrieve.mockRejectedValue(new Error('No such subscription: sub_1'));
    await getOrgBillingStateFresh(4);
    expect(mockUpdate).toHaveBeenCalledWith(4, expect.objectContaining({ subscriptionStatus: 'canceled' }), expect.anything());
  });

  it('keeps the stored row when Stripe is unreachable', async () => {
    const stale = state({ orgId: 5, currentPeriodEnd: '2026-09-15T17:01:12.000Z' });
    mockGet.mockResolvedValue(stale);
    mockRetrieve.mockRejectedValue(new Error('connect ETIMEDOUT'));
    await expect(getOrgBillingStateFresh(5)).resolves.toBe(stale);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('re-syncs a trialing row whose trial ended', async () => {
    mockGet.mockResolvedValue(state({
      orgId: 6,
      subscriptionStatus: 'trialing',
      trialEndsAt: '2026-09-10T00:00:00.000Z',
      currentPeriodEnd: '2026-09-10T00:00:00.000Z',
    }));
    mockRetrieve.mockResolvedValue({ id: 'sub_1', status: 'active' });
    await getOrgBillingStateFresh(6);
    expect(mockRetrieve).toHaveBeenCalled();
  });

  it('leaves canceled rows alone', async () => {
    mockGet.mockResolvedValue(state({ orgId: 7, subscriptionStatus: 'canceled', currentPeriodEnd: '2026-09-15T17:01:12.000Z' }));
    await getOrgBillingStateFresh(7);
    expect(mockRetrieve).not.toHaveBeenCalled();
  });
});
