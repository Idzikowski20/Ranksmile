/**
 * @jest-environment node
 */
import { hasNonTerminalStripeSubscription } from '../../lib/orgBilling';
import {
  isOrgInStarterNudgeAgeWindow,
  runStarterNudgeCron,
} from '../../lib/emails/runStarterNudgeCron';

jest.mock('../../lib/ensureBillingTables', () => ({
  ensureBillingTables: jest.fn(async () => undefined),
}));

jest.mock('../../lib/db/query', () => ({
  queryRows: jest.fn(),
}));

jest.mock('../../lib/orgBilling', () => {
  const actual = jest.requireActual('../../lib/orgBilling') as typeof import('../../lib/orgBilling');
  return {
    ...actual,
    getOrgBillingState: jest.fn(),
    updateOrgBillingState: jest.fn(async () => undefined),
  };
});

jest.mock('../../lib/emails/sendStarterNudgeEmail', () => ({
  sendStarterNudgeEmail: jest.fn(),
}));

jest.mock('../../database/database', () => ({
  __esModule: true,
  default: { query: jest.fn() },
}));

import { queryRows } from '../../lib/db/query';
import { getOrgBillingState, updateOrgBillingState } from '../../lib/orgBilling';
import { sendStarterNudgeEmail } from '../../lib/emails/sendStarterNudgeEmail';
import db from '../../database/database';

const mockQueryRows = queryRows as jest.MockedFunction<typeof queryRows>;
const mockGetBilling = getOrgBillingState as jest.MockedFunction<typeof getOrgBillingState>;
const mockUpdate = updateOrgBillingState as jest.MockedFunction<typeof updateOrgBillingState>;
const mockSend = sendStarterNudgeEmail as jest.MockedFunction<typeof sendStarterNudgeEmail>;
const mockDbQuery = db.query as jest.MockedFunction<typeof db.query>;

describe('starter nudge cron selection', () => {
  const now = new Date('2026-07-27T12:00:00Z');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('age window is 3–10 days inclusive', () => {
    expect(isOrgInStarterNudgeAgeWindow('2026-07-24T12:00:00Z', now)).toBe(true);
    expect(isOrgInStarterNudgeAgeWindow('2026-07-17T12:00:00Z', now)).toBe(true);
    expect(isOrgInStarterNudgeAgeWindow('2026-07-26T12:00:00Z', now)).toBe(false);
    expect(isOrgInStarterNudgeAgeWindow('2026-07-10T12:00:00Z', now)).toBe(false);
  });

  it('hasNonTerminalStripeSubscription skips trial/active', () => {
    expect(hasNonTerminalStripeSubscription({
      stripeSubscriptionId: 'sub_1',
      subscriptionStatus: 'trialing',
    })).toBe(true);
    expect(hasNonTerminalStripeSubscription({
      stripeSubscriptionId: 'sub_1',
      subscriptionStatus: 'canceled',
    })).toBe(false);
    expect(hasNonTerminalStripeSubscription(null)).toBe(false);
  });

  it('sends to free org owner and marks starter_nudge_sent_at', async () => {
    mockQueryRows.mockResolvedValueOnce([{ id: 10 }]);
    mockGetBilling.mockResolvedValueOnce({
      orgId: 10,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      planSlug: null,
      billingPeriod: null,
      subscriptionStatus: null,
      trialEndsAt: null,
    trialConsumedAt: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      lastCheckoutStartedAt: null,
      starterNudgeSentAt: null,
    });
    mockDbQuery.mockResolvedValueOnce([[{ email: 'owner@example.com' }]] as never);
    mockSend.mockResolvedValueOnce({ sent: true });

    const result = await runStarterNudgeCron(now);

    expect(result).toEqual({ scanned: 1, sent: 1, skipped: 0 });
    expect(mockSend).toHaveBeenCalledWith('owner@example.com');
    expect(mockUpdate).toHaveBeenCalledWith(10, { starterNudgeSentAt: now });
  });

  it('skips paid org and does not mark sent', async () => {
    mockQueryRows.mockResolvedValueOnce([{ id: 11 }]);
    mockGetBilling.mockResolvedValueOnce({
      orgId: 11,
      stripeCustomerId: 'cus_1',
      stripeSubscriptionId: 'sub_paid',
      planSlug: 'starter',
      billingPeriod: 'monthly',
      subscriptionStatus: 'active',
      trialEndsAt: null,
    trialConsumedAt: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      lastCheckoutStartedAt: null,
      starterNudgeSentAt: null,
    });

    const result = await runStarterNudgeCron(now);

    expect(result).toEqual({ scanned: 1, sent: 0, skipped: 1 });
    expect(mockSend).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('does not mark when sendMail fails (idempotent retry)', async () => {
    mockQueryRows.mockResolvedValueOnce([{ id: 12 }]);
    mockGetBilling.mockResolvedValueOnce({
      orgId: 12,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      planSlug: null,
      billingPeriod: null,
      subscriptionStatus: null,
      trialEndsAt: null,
    trialConsumedAt: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      lastCheckoutStartedAt: null,
      starterNudgeSentAt: null,
    });
    mockDbQuery.mockResolvedValueOnce([[{ email: 'owner@example.com' }]] as never);
    mockSend.mockResolvedValueOnce({ sent: false });

    const result = await runStarterNudgeCron(now);

    expect(result).toEqual({ scanned: 1, sent: 0, skipped: 1 });
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
