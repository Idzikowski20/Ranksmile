import type Stripe from 'stripe';
import { activateTrialFromSetupIntent } from '../../lib/billingActivateTrial';
import { syncSubscriptionToOrg } from '../../lib/stripeBillingSync';
import { claimTrialActivation, updateOrgBillingState } from '../../lib/orgBilling';
import { appendBillingDomainEvent } from '../../lib/billing/domainEvents';

jest.mock('../../lib/orgBilling', () => ({
  getOrgBillingState: jest.fn(async () => ({ trialConsumedAt: null })),
  claimTrialActivation: jest.fn(async () => true),
  updateOrgBillingState: jest.fn(async () => undefined),
}));

jest.mock('../../lib/billingAudit', () => ({
  BillingSource: {
    ACTIVATE_TRIAL: 'ACTIVATE_TRIAL',
    WEBHOOK_SETUP: 'WEBHOOK_SETUP',
    WEBHOOK_SUB: 'WEBHOOK_SUB',
    CHECKOUT: 'CHECKOUT',
    RECONCILE: 'RECONCILE',
  },
  emitBillingEvent: jest.fn(async () => undefined),
  ensureCorrelationId: (id?: string | null) => (typeof id === 'string' && id.trim() ? id.trim() : 'corr-test'),
}));

jest.mock('../../lib/stripeBillingSync', () => ({
  syncSubscriptionToOrg: jest.fn(async () => undefined),
}));

jest.mock('../../lib/billing/domainEvents', () => ({
  appendBillingDomainEvent: jest.fn(async () => undefined),
}));

jest.mock('../../lib/billingPlans', () => ({
  getCheckoutPlan: jest.fn((slug: string) => (
    slug === 'growth' ? { slug: 'growth', name: 'Growth', priceMonthly: 59, priceYearly: 49, features: [] } : undefined
  )),
}));

jest.mock('../../lib/stripePrices', () => ({
  getStripePriceId: jest.fn(() => 'price_growth_y'),
}));

const mockUpdate = updateOrgBillingState as jest.MockedFunction<typeof updateOrgBillingState>;
const mockClaim = claimTrialActivation as jest.MockedFunction<typeof claimTrialActivation>;
const mockSync = syncSubscriptionToOrg as jest.MockedFunction<typeof syncSubscriptionToOrg>;
const mockAppend = appendBillingDomainEvent as jest.MockedFunction<typeof appendBillingDomainEvent>;

describe('activateTrialFromSetupIntent', () => {
  beforeEach(() => {
    mockUpdate.mockClear();
    mockClaim.mockReset();
    mockClaim.mockResolvedValue(true);
    mockSync.mockClear();
    mockAppend.mockClear();
  });

  it('rejects when SetupIntent is not succeeded', async () => {
    const stripe = {
      customers: { update: jest.fn() },
      subscriptions: { create: jest.fn() },
      paymentIntents: { create: jest.fn() },
    } as unknown as Stripe;

    const result = await activateTrialFromSetupIntent(stripe, {
      orgId: 6,
      userId: 'u1',
      setupIntent: {
        id: 'seti_1',
        status: 'requires_payment_method',
        metadata: { org_id: '6', plan_slug: 'growth', billing_period: 'yearly', checkout_mode: 'trial' },
        payment_method: null,
        customer: 'cus_1',
      } as unknown as Stripe.SetupIntent,
    });

    expect(result).toEqual({ ok: false, status: 409, error: 'Payment method is not confirmed yet' });
    expect(stripe.subscriptions.create).not.toHaveBeenCalled();
    expect(stripe.customers.update).not.toHaveBeenCalled();
    expect(stripe.paymentIntents.create).not.toHaveBeenCalled();
  });

  it('sets dual default PM then creates trial subscription — zero PaymentIntent calls', async () => {
    const created = {
      id: 'sub_new',
      status: 'trialing',
      default_payment_method: 'pm_1',
      items: { data: [{ price: { id: 'price_growth_y' } }] },
      metadata: {},
    };
    const stripe = {
      customers: {
        update: jest.fn(async () => ({ id: 'cus_1' })),
      },
      subscriptions: {
        create: jest.fn(async () => created),
      },
      paymentIntents: { create: jest.fn() },
    } as unknown as Stripe;

    const result = await activateTrialFromSetupIntent(stripe, {
      orgId: 6,
      userId: 'u1',
      setupIntent: {
        id: 'seti_ok',
        status: 'succeeded',
        metadata: {
          org_id: '6',
          plan_slug: 'growth',
          billing_period: 'yearly',
          checkout_mode: 'trial',
          checkout_attempt_id: '11111111-1111-4111-8111-111111111111',
        },
        payment_method: 'pm_1',
        customer: 'cus_1',
      } as unknown as Stripe.SetupIntent,
    });

    expect(result).toEqual({ ok: true, subscriptionId: 'sub_new' });
    expect(stripe.customers.update).toHaveBeenCalledWith(
      'cus_1',
      { invoice_settings: { default_payment_method: 'pm_1' } },
      expect.objectContaining({
        idempotencyKey: 'org-6-trial-customer-default-11111111-1111-4111-8111-111111111111',
      }),
    );
    expect(stripe.subscriptions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: 'cus_1',
        default_payment_method: 'pm_1',
        trial_period_days: 7,
        automatic_tax: { enabled: true },
      }),
      expect.objectContaining({ idempotencyKey: 'org-6-trial-activate-11111111-1111-4111-8111-111111111111' }),
    );
    expect(stripe.paymentIntents.create).not.toHaveBeenCalled();
    expect(mockSync).toHaveBeenCalled();
    expect(mockAppend).toHaveBeenCalledWith(expect.objectContaining({ type: 'CARD_ADDED', source: 'checkout' }));
    expect(mockAppend).toHaveBeenCalledWith(expect.objectContaining({ type: 'TRIAL_STARTED', source: 'checkout' }));
    expect(mockAppend).toHaveBeenCalledWith(expect.objectContaining({ type: 'SUBSCRIPTION_CREATED', source: 'checkout' }));
  });

  it('does not create a second trial when another attempt owns the claim', async () => {
    mockClaim.mockResolvedValue(false);
    const stripe = {
      customers: { update: jest.fn() },
      subscriptions: { create: jest.fn() },
      paymentIntents: { create: jest.fn() },
    } as unknown as Stripe;

    const result = await activateTrialFromSetupIntent(stripe, {
      orgId: 6,
      userId: 'u1',
      setupIntent: {
        id: 'seti_loser',
        status: 'succeeded',
        metadata: { org_id: '6', plan_slug: 'growth', billing_period: 'yearly', checkout_mode: 'trial' },
        payment_method: 'pm_1',
        customer: 'cus_1',
      } as unknown as Stripe.SetupIntent,
    });

    expect(result).toEqual({ ok: false, status: 409, error: 'This organization has already started a trial activation' });
    expect(stripe.customers.update).not.toHaveBeenCalled();
    expect(stripe.subscriptions.create).not.toHaveBeenCalled();
  });
});
