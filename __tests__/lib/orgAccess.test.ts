import { createBillingAccessCheck } from '@/src/infrastructure/billing/orgAccess';
import { getOrgBillingStateFresh } from '@/src/infrastructure/billing/stripeBillingReconcile';
import { queryOne } from '@/src/infrastructure/db/query';
import type { OrgBillingState } from '@/src/infrastructure/billing/orgBilling';

jest.mock('@/src/infrastructure/billing/stripeBillingReconcile', () => ({
  getOrgBillingStateFresh: jest.fn(),
}));
jest.mock('@/src/infrastructure/db/query', () => ({ queryOne: jest.fn() }));

const mockBilling = getOrgBillingStateFresh as jest.MockedFunction<typeof getOrgBillingStateFresh>;
const mockQueryOne = queryOne as jest.MockedFunction<typeof queryOne>;

function billing(partial: Partial<OrgBillingState>): OrgBillingState {
  return {
    orgId: 1,
    stripeCustomerId: null,
    stripeSubscriptionId: 'sub_1',
    planSlug: 'growth',
    billingPeriod: 'monthly',
    subscriptionStatus: 'active',
    trialEndsAt: null,
    trialConsumedAt: null,
    currentPeriodEnd: '2099-01-01T00:00:00.000Z',
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

describe('createBillingAccessCheck', () => {
  beforeEach(() => jest.resetAllMocks());

  it('allows an active org and memoizes the verdict', async () => {
    mockBilling.mockResolvedValue(billing({}));
    const check = createBillingAccessCheck();
    await expect(check.forOrg(1)).resolves.toBe(true);
    await expect(check.forOrg(1)).resolves.toBe(true);
    expect(mockBilling).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['canceled', billing({ subscriptionStatus: 'canceled' })],
    ['no subscription', null],
    ['lapsed cancel', billing({ cancelAtPeriodEnd: true, currentPeriodEnd: '2020-01-01T00:00:00.000Z' })],
    ['payment-failed lock', billing({ subscriptionStatus: 'past_due', paymentFailedLockedAt: '2026-09-01T00:00:00.000Z' })],
  ])('denies %s', async (_label, state) => {
    mockBilling.mockResolvedValue(state);
    await expect(createBillingAccessCheck().forOrg(1)).resolves.toBe(false);
  });

  it('denies when there is no org or the lookup throws', async () => {
    const check = createBillingAccessCheck();
    await expect(check.forOrg(null)).resolves.toBe(false);
    mockBilling.mockRejectedValue(new Error('db down'));
    await expect(check.forOrg(2)).resolves.toBe(false);
  });

  it('resolves a domain through its workspace org', async () => {
    mockQueryOne.mockResolvedValueOnce({ org_id: 7 }).mockResolvedValueOnce(undefined);
    mockBilling.mockResolvedValue(billing({}));
    const check = createBillingAccessCheck();
    await expect(check.forDomain(10)).resolves.toBe(true);
    expect(mockBilling).toHaveBeenCalledWith(7);
    await expect(check.forDomain(11)).resolves.toBe(false);
  });
});
