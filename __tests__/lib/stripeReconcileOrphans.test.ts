import type Stripe from 'stripe';
import { reconcileStripeBilling } from '@/src/infrastructure/billing/stripeBillingReconcile';
import { syncSubscriptionToOrg } from '@/src/infrastructure/billing/stripeBillingSync';
import { getOrgIdByStripeCustomerId } from '@/src/infrastructure/billing/orgBilling';
import { queryOne, queryRows } from '@/src/infrastructure/db/query';

jest.mock('@/database/database', () => ({ __esModule: true, default: { query: jest.fn() } }));
jest.mock('@/src/infrastructure/persistence/schema/ensureBillingTables', () => ({
  ensureBillingTables: jest.fn(async () => undefined),
}));
jest.mock('@/src/infrastructure/billing/orgBilling', () => ({
  getOrgBillingState: jest.fn(),
  getOrgIdByStripeCustomerId: jest.fn(async () => null),
  updateOrgBillingState: jest.fn(async () => undefined),
  hasNonTerminalStripeSubscription: jest.requireActual('@/src/infrastructure/billing/orgBilling').hasNonTerminalStripeSubscription,
}));
jest.mock('@/src/infrastructure/billing/stripeBillingSync', () => ({
  syncSubscriptionToOrg: jest.fn(async () => undefined),
  orgIdFromMetadata: jest.requireActual('@/src/infrastructure/billing/stripeBillingSync').orgIdFromMetadata,
}));
jest.mock('@/src/infrastructure/db/query', () => ({ queryRows: jest.fn(), queryOne: jest.fn() }));
const mockList = jest.fn();
jest.mock('@/src/infrastructure/billing/stripe', () => ({
  isStripeConfigured: () => true,
  getStripe: () => ({ subscriptions: { list: mockList, retrieve: jest.fn() } }),
}));

type OrgRow = {
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  subscription_status: string | null;
};

const mockSync = syncSubscriptionToOrg as jest.MockedFunction<typeof syncSubscriptionToOrg>;

function sub(id: string, customer: string, metadata: Record<string, string>): Stripe.Subscription {
  return { id, customer, metadata, status: 'active' } as unknown as Stripe.Subscription;
}

function setup(org: OrgRow, subs: Stripe.Subscription[], memberUserIds: string[] = []) {
  (queryRows as jest.Mock).mockImplementation(async (sql: string) => (
    sql.includes('organization_members') ? memberUserIds.map((user_id) => ({ user_id })) : []
  ));
  (queryOne as jest.Mock).mockImplementation(async (sql: string) => (
    sql.includes('organization_members') ? (memberUserIds.length ? { one: 1 } : undefined) : org
  ));
  mockList.mockImplementation(async ({ status }: { status: string }) => ({ data: status === 'active' ? subs : [] }));
}

beforeEach(() => {
  jest.clearAllMocks();
  (getOrgIdByStripeCustomerId as jest.Mock).mockResolvedValue(null);
});

it('never moves an org onto another customer\'s subscription that shares its metadata org_id', async () => {
  setup(
    { stripe_subscription_id: 'sub_mine', stripe_customer_id: 'cus_mine', subscription_status: 'canceled' },
    [sub('sub_foreign', 'cus_other_env', { org_id: '2' })],
  );
  const res = await reconcileStripeBilling();
  expect(mockSync).not.toHaveBeenCalled();
  expect(res.orphansRecovered).toBe(0);
});

it('does not replace a live tracked subscription with another one of the same customer', async () => {
  setup(
    { stripe_subscription_id: 'sub_mine', stripe_customer_id: 'cus_mine', subscription_status: 'active' },
    [sub('sub_second', 'cus_mine', { org_id: '2' })],
  );
  await reconcileStripeBilling();
  expect(mockSync).not.toHaveBeenCalled();
});

it('recovers a subscription of the org\'s own customer when the tracked one is gone', async () => {
  setup(
    { stripe_subscription_id: null, stripe_customer_id: 'cus_mine', subscription_status: 'canceled' },
    [sub('sub_new', 'cus_mine', { org_id: '2' })],
  );
  const res = await reconcileStripeBilling();
  expect(mockSync).toHaveBeenCalledWith(2, expect.objectContaining({ id: 'sub_new' }), undefined, expect.anything());
  expect(res.orphansRecovered).toBe(1);
});

it('recovers by customer id lookup when metadata is missing', async () => {
  (getOrgIdByStripeCustomerId as jest.Mock).mockResolvedValue(5);
  setup(
    { stripe_subscription_id: null, stripe_customer_id: 'cus_mine', subscription_status: null },
    [sub('sub_new', 'cus_mine', {})],
  );
  await reconcileStripeBilling();
  expect(mockSync).toHaveBeenCalledWith(5, expect.objectContaining({ id: 'sub_new' }), undefined, expect.anything());
});

it('without a stored customer, recovers only when the subscribing user is a member of the org', async () => {
  setup(
    { stripe_subscription_id: null, stripe_customer_id: null, subscription_status: null },
    [sub('sub_a', 'cus_x', { org_id: '2', user_id: 'stranger' })],
  );
  await reconcileStripeBilling();
  expect(mockSync).not.toHaveBeenCalled();

  setup(
    { stripe_subscription_id: null, stripe_customer_id: null, subscription_status: null },
    [sub('sub_b', 'cus_x', { org_id: '2', user_id: 'member' })],
    ['member'],
  );
  await reconcileStripeBilling();
  expect(mockSync).toHaveBeenCalledWith(2, expect.objectContaining({ id: 'sub_b' }), undefined, expect.anything());
});

it('prefers the org that owns the Stripe customer over a stale metadata org_id', async () => {
  (getOrgIdByStripeCustomerId as jest.Mock).mockResolvedValue(5);
  setup(
    { stripe_subscription_id: null, stripe_customer_id: 'cus_mine', subscription_status: null },
    [sub('sub_new', 'cus_mine', { org_id: '2' })],
  );
  await reconcileStripeBilling();
  expect(mockSync).toHaveBeenCalledWith(5, expect.objectContaining({ id: 'sub_new' }), undefined, expect.anything());
  expect(mockSync).not.toHaveBeenCalledWith(2, expect.anything(), undefined, expect.anything());
});
