import type { NextApiRequest, NextApiResponse } from 'next';

import type { OrgBillingState } from '../../lib/orgBilling';

jest.mock('../../database/database', () => ({
  __esModule: true,
  default: { query: jest.fn() },
}));

jest.mock('../../lib/stripe', () => ({
  getStripe: jest.fn(),
  getStripeWebhookSecret: jest.fn(),
  isStripeConfigured: jest.fn(() => false),
}));

jest.mock('../../lib/readRawBody', () => ({
  readRawBody: jest.fn(),
}));

jest.mock('../../lib/billingEmailClaim', () => ({
  claimBillingEmailAndEnqueue: jest.fn(),
}));

jest.mock('../../lib/stripeBillingSync', () => {
  const actual = jest.requireActual('../../lib/stripeBillingSync') as typeof import('../../lib/stripeBillingSync');
  return {
    ...actual,
    syncSubscriptionToOrg: jest.fn(),
    syncCheckoutSessionToOrg: jest.fn(),
  };
});

jest.mock('../../lib/orgBilling', () => ({
  getOrgBillingState: jest.fn(),
  getOrgIdByStripeCustomerId: jest.fn(),
  updateOrgBillingState: jest.fn(),
}));

jest.mock('../../utils/getUser', () => ({
  getCurrentUserId: jest.fn(),
  getCurrentUser: jest.fn(),
}));

jest.mock('../../utils/verifyUser', () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue('authorized'),
}));

jest.mock('../../lib/tenancy', () => ({
  ensureUserTenancy: jest.fn(),
  getAccessibleWorkspaceIds: jest.fn(),
}));

jest.mock('../../lib/notifications/inboxService', () => ({
  listInboxForUser: jest.fn(),
}));

jest.mock('../../lib/notifications/syncOptimizationInbox', () => ({
  syncOptimizationInbox: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../lib/errors', () => ({
  getErrorMessage: jest.fn(() => 'DB error'),
}));

import stripeWebhookHandler from '../../pages/api/webhooks/stripe';
import inboxHandler from '../../pages/api/inbox';
import billingSubscriptionHandler from '../../pages/api/billing/subscription';
import db from '../../database/database';
import { getStripe, getStripeWebhookSecret } from '../../lib/stripe';
import { readRawBody } from '../../lib/readRawBody';
import { claimBillingEmailAndEnqueue } from '../../lib/billingEmailClaim';
import { syncSubscriptionToOrg } from '../../lib/stripeBillingSync';
import { getOrgBillingState } from '../../lib/orgBilling';
import { ensureUserTenancy, getAccessibleWorkspaceIds } from '../../lib/tenancy';
import { getCurrentUserId } from '../../utils/getUser';
import { listInboxForUser } from '../../lib/notifications/inboxService';

type TestResponse = NextApiResponse & { statusCode?: number; body?: unknown };

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

const makeReq = (method: string, url: string): NextApiRequest => ({
  method: method as NextApiRequest['method'],
  url,
  query: {},
  cookies: {},
  headers: {},
} as NextApiRequest);

describe('payment failed lock (webhook + access enforcement)', () => {
  const orgId = 1;
  const userId = 'user-1';

  const subA = 'sub_A';
  const customerA = 'cus_A';

  const subB = 'sub_B';
  const customerB = 'cus_B';

  const baseBilling: OrgBillingState = {
    orgId,
    stripeCustomerId: customerA,
    stripeSubscriptionId: subA,
    planSlug: 'growth',
    billingPeriod: 'monthly',
    subscriptionStatus: 'active',
    trialEndsAt: null,
    trialConsumedAt: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    lastCheckoutStartedAt: null,
    starterNudgeSentAt: null,
    paymentFailedLockedAt: null,
    paymentFailedInvoiceId: null,
    paymentFailedSubscriptionId: null,
    paymentFailedCustomerId: null,
    paymentLockLastEventCreatedAt: null,
    paymentLockLastEventId: null,
  };

  let billing: OrgBillingState = { ...baseBilling };
  let currentWebhookEvent: unknown = null;

  const stripeMock = {
    subscriptions: {
      retrieve: jest.fn(),
    },
    customers: {
      retrieve: jest.fn(),
    },
    billingPortal: {
      sessions: {
        create: jest.fn().mockResolvedValue({ url: 'https://stripe.test/portal' }),
      },
    },
    webhooks: {
      constructEvent: jest.fn().mockImplementation(() => currentWebhookEvent),
    },
  };

  beforeEach(() => {
    billing = { ...baseBilling };

    jest.clearAllMocks();

    (getStripe as jest.MockedFunction<typeof getStripe>).mockReturnValue(stripeMock as unknown as ReturnType<typeof getStripe>);
    (getStripeWebhookSecret as jest.MockedFunction<typeof getStripeWebhookSecret>).mockReturnValue('whsec_test');
    (readRawBody as jest.MockedFunction<typeof readRawBody>).mockResolvedValue('raw-body');

    (getCurrentUserId as jest.MockedFunction<typeof getCurrentUserId>).mockResolvedValue(userId);
    (ensureUserTenancy as jest.MockedFunction<typeof ensureUserTenancy>).mockResolvedValue({ orgId });
    (getAccessibleWorkspaceIds as jest.MockedFunction<typeof getAccessibleWorkspaceIds>).mockResolvedValue([]);

    (listInboxForUser as jest.MockedFunction<typeof listInboxForUser>).mockResolvedValue({ items: [] });

    (syncSubscriptionToOrg as jest.MockedFunction<typeof syncSubscriptionToOrg>).mockResolvedValue(undefined);
    (claimBillingEmailAndEnqueue as jest.MockedFunction<typeof claimBillingEmailAndEnqueue>).mockResolvedValue(undefined);

    (getOrgBillingState as jest.MockedFunction<typeof getOrgBillingState>).mockImplementation(async () => billing);

    stripeMock.subscriptions.retrieve.mockImplementation(async (id: string) => {
      if (id === subA) {
        return {
          id: subA,
          status: 'active',
          customer: customerA,
          metadata: { org_id: String(orgId), plan_slug: 'growth', billing_period: 'monthly' },
          items: { data: [{ price: { id: 'price_growth' } }] },
          trial_end: null,
          current_period_end: null,
          cancel_at_period_end: false,
        };
      }
      if (id === subB) {
        return {
          id: subB,
          status: 'active',
          customer: customerB,
          metadata: { org_id: String(orgId), plan_slug: 'growth', billing_period: 'monthly' },
          items: { data: [{ price: { id: 'price_growth' } }] },
          trial_end: null,
          current_period_end: null,
          cancel_at_period_end: false,
        };
      }
      return {
        id,
        status: 'active',
        customer: customerA,
        metadata: { org_id: String(orgId), plan_slug: 'growth', billing_period: 'monthly' },
        items: { data: [{ price: { id: 'price_growth' } }] },
        trial_end: null,
        current_period_end: null,
        cancel_at_period_end: false,
      };
    });

    (db.query as jest.MockedFunction<typeof db.query>).mockImplementation(async (sql: string, opts: { replacements: unknown[] }) => {
      const replacements = opts.replacements;
      // LOCK query: SET payment_failed_locked_at = ? ... payment_lock_last_event_created_at = ?
      if (sql.includes('SET payment_failed_locked_at = ?')) {
        const paymentFailedLockedAtIso = String(replacements[0]);
        const invoiceId = String(replacements[1]);
        const subscriptionId = String(replacements[2]);
        const customerId = String(replacements[3]);
        const eventCreatedAtIso = String(replacements[7] ?? replacements[4]);
        const eventId = String(replacements[9] ?? replacements[5]);

        const currentCreatedAt = billing.paymentLockLastEventCreatedAt;
        const currentEventId = billing.paymentLockLastEventId;

        let allow = false;
        if (currentCreatedAt == null) {
          allow = true;
        } else {
          const currentTime = Date.parse(currentCreatedAt);
          const newTime = Date.parse(eventCreatedAtIso);
          if (currentTime < newTime) allow = true;
          if (currentTime === newTime) {
            if (currentEventId == null) allow = true;
            if (currentEventId !== eventId) allow = true;
          }
        }

        if (allow) {
          billing = {
            ...billing,
            paymentFailedLockedAt: paymentFailedLockedAtIso,
            paymentFailedInvoiceId: invoiceId,
            paymentFailedSubscriptionId: subscriptionId,
            paymentFailedCustomerId: customerId,
            paymentLockLastEventCreatedAt: eventCreatedAtIso,
            paymentLockLastEventId: eventId,
          };
        }
        return;
      }

      // UNLOCK query: SET payment_failed_locked_at = NULL ... payment_lock_last_event_created_at = ?
      if (sql.includes('payment_failed_locked_at = NULL')) {
        const eventCreatedAtIso = String(replacements[0]);
        const eventId = String(replacements[1]);
        const subscriptionId = String(replacements[3]);
        const customerId = String(replacements[4]);

        const currentLockedAt = billing.paymentFailedLockedAt;
        const currentSubId = billing.paymentFailedSubscriptionId;
        const currentCustomerId = billing.paymentFailedCustomerId;
        const currentCreatedAt = billing.paymentLockLastEventCreatedAt;
        const currentEventId = billing.paymentLockLastEventId;

        const orderingOk =
          currentCreatedAt == null
            || Date.parse(currentCreatedAt) < Date.parse(eventCreatedAtIso)
            || (Date.parse(currentCreatedAt) === Date.parse(eventCreatedAtIso)
              && (currentEventId == null || currentEventId !== eventId));

        const identityOk =
          currentLockedAt != null
          && currentSubId === subscriptionId
          && currentCustomerId === customerId;

        if (identityOk && orderingOk) {
          billing = {
            ...billing,
            paymentFailedLockedAt: null,
            paymentFailedInvoiceId: null,
            paymentFailedSubscriptionId: null,
            paymentFailedCustomerId: null,
            paymentLockLastEventCreatedAt: eventCreatedAtIso,
            paymentLockLastEventId: eventId,
          };
        }
        return;
      }

      if (sql.includes('user_onboarding')) {
        return [[{ completed: 1 }]];
      }
      if (sql.includes("status = 'ready'") && /COUNT/i.test(sql)) {
        return [[{ n: 1 }]];
      }
      if (sql.includes("status = 'ready'") && sql.includes('SELECT id')) {
        return [[{ id: 1 }]];
      }
      if (sql.includes("status = 'setup'")) {
        return [[]];
      }

      return;
    });
  });

  const callStripeWebhook = async (event: unknown) => {
    currentWebhookEvent = event;
    const req = {
      method: 'POST',
      url: '/api/webhooks/stripe',
      query: {},
      cookies: {},
      headers: { 'stripe-signature': 'sig-test' },
      body: {},
    } as unknown as NextApiRequest;
    const res = makeRes();
    await stripeWebhookHandler(req, res);
    return res;
  };

  it('LOCK on invoice.payment_failed -> protected API 402, billing API 200', async () => {
    const lockEventCreated = 1700000000;
    const paymentFailedEvent = {
      id: 'evt_A',
      type: 'invoice.payment_failed',
      created: lockEventCreated,
      data: {
        object: {
          id: 'in_A',
          created: lockEventCreated,
          subscription: subA,
          customer_email: 'billing@example.com',
          customer: customerA,
        },
      },
    };

    await callStripeWebhook(paymentFailedEvent);

    const inboxReq = makeReq('GET', '/api/inbox');
    const inboxRes = makeRes();
    await inboxHandler(inboxReq, inboxRes);
    expect(inboxRes.statusCode).toBe(402);
    const body = inboxRes.body as { code?: string; message?: string } | undefined;
    expect(body?.code).toBe('PAYMENT_FAILED_LOCKED');

    const billingReq = makeReq('GET', '/api/billing/subscription');
    const billingRes = makeRes();
    await billingSubscriptionHandler(billingReq, billingRes);
    expect(billingRes.statusCode).toBe(200);
  });

  it('UNLOCK on invoice.paid for same org/sub/customer -> protected API becomes 200', async () => {
    const lockCreated = 1700000000;
    const paidCreated = 1700000100;

    await callStripeWebhook({
      id: 'evt_A',
      type: 'invoice.payment_failed',
      created: lockCreated,
      data: {
        object: {
          id: 'in_A',
          created: lockCreated,
          subscription: subA,
          customer_email: 'billing@example.com',
          customer: customerA,
        },
      },
    });

    await callStripeWebhook({
      id: 'evt_A_paid',
      type: 'invoice.paid',
      created: paidCreated,
      data: {
        object: {
          id: 'in_A_paid',
          created: paidCreated,
          subscription: subA,
          customer: customerA,
        },
      },
    });

    const inboxReq = makeReq('GET', '/api/inbox');
    const inboxRes = makeRes();
    await inboxHandler(inboxReq, inboxRes);
    expect(inboxRes.statusCode).toBe(200);
  });

  it('delayed invoice.payment_failed after unlock must NOT re-lock', async () => {
    const lockCreated = 1700000000;
    const unlockCreated = 1700000100;

    await callStripeWebhook({
      id: 'evt_A',
      type: 'invoice.payment_failed',
      created: lockCreated,
      data: {
        object: { id: 'in_A', created: lockCreated, subscription: subA, customer_email: 'billing@example.com', customer: customerA },
      },
    });

    await callStripeWebhook({
      id: 'evt_A_paid',
      type: 'invoice.paid',
      created: unlockCreated,
      data: { object: { id: 'in_A_paid', created: unlockCreated, subscription: subA, customer: customerA } },
    });

    // Deliver the old failure event late (same event id, older created)
    await callStripeWebhook({
      id: 'evt_A',
      type: 'invoice.payment_failed',
      created: lockCreated,
      data: {
        object: { id: 'in_A', created: lockCreated, subscription: subA, customer_email: 'billing@example.com', customer: customerA },
      },
    });

    const inboxReq = makeReq('GET', '/api/inbox');
    const inboxRes = makeRes();
    await inboxHandler(inboxReq, inboxRes);
    expect(inboxRes.statusCode).toBe(200);
  });

  it('invoice.paid for unrelated subscription/customer must NOT unlock', async () => {
    const lockCreated = 1700000000;
    const unlockCreated = 1700000100;

    await callStripeWebhook({
      id: 'evt_A',
      type: 'invoice.payment_failed',
      created: lockCreated,
      data: { object: { id: 'in_A', created: lockCreated, subscription: subA, customer_email: 'billing@example.com', customer: customerA } },
    });

    await callStripeWebhook({
      id: 'evt_other_paid',
      type: 'invoice.paid',
      created: unlockCreated,
      data: { object: { id: 'in_other_paid', created: unlockCreated, subscription: subB, customer: customerB } },
    });

    const inboxReq = makeReq('GET', '/api/inbox');
    const inboxRes = makeRes();
    await inboxHandler(inboxReq, inboxRes);
    expect(inboxRes.statusCode).toBe(402);
  });

  it('new legitimate invoice.payment_failed after recovery must LOCK again', async () => {
    const lockCreated = 1700000000;
    const unlockCreated = 1700000100;
    const secondFailureCreated = 1700000200;

    await callStripeWebhook({
      id: 'evt_A',
      type: 'invoice.payment_failed',
      created: lockCreated,
      data: { object: { id: 'in_A', created: lockCreated, subscription: subA, customer_email: 'billing@example.com', customer: customerA } },
    });

    await callStripeWebhook({
      id: 'evt_A_paid',
      type: 'invoice.paid',
      created: unlockCreated,
      data: { object: { id: 'in_A_paid', created: unlockCreated, subscription: subA, customer: customerA } },
    });

    await callStripeWebhook({
      id: 'evt_B',
      type: 'invoice.payment_failed',
      created: secondFailureCreated,
      data: { object: { id: 'in_B', created: secondFailureCreated, subscription: subB, customer_email: 'billing@example.com', customer: customerB } },
    });

    const inboxReq = makeReq('GET', '/api/inbox');
    const inboxRes = makeRes();
    await inboxHandler(inboxReq, inboxRes);
    expect(inboxRes.statusCode).toBe(402);
  });

  it('idempotency: delivering the same invoice.payment_failed event twice is stable/no-op', async () => {
    const lockCreated = 1700000000;

    await callStripeWebhook({
      id: 'evt_A',
      type: 'invoice.payment_failed',
      created: lockCreated,
      data: { object: { id: 'in_A', created: lockCreated, subscription: subA, customer_email: 'billing@example.com', customer: customerA } },
    });

    const stateAfterFirst: OrgBillingState = { ...billing };

    await callStripeWebhook({
      id: 'evt_A',
      type: 'invoice.payment_failed',
      created: lockCreated,
      data: { object: { id: 'in_A', created: lockCreated, subscription: subA, customer_email: 'billing@example.com', customer: customerA } },
    });

    // Should remain locked with the same projection values.
    expect(billing.paymentFailedLockedAt).toBe(stateAfterFirst.paymentFailedLockedAt);
    expect(billing.paymentFailedInvoiceId).toBe(stateAfterFirst.paymentFailedInvoiceId);
    expect(billing.paymentFailedSubscriptionId).toBe(stateAfterFirst.paymentFailedSubscriptionId);
    expect(billing.paymentLockLastEventId).toBe(stateAfterFirst.paymentLockLastEventId);
  });
});

