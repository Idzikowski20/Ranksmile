import {
  buildAccessSnapshot,
  resolveAppState,
  projectBillingState,
  projectWorkspaceState,
  allowsFrontend,
  allowsApi,
  resolveRedirect,
  redirectLoopKey,
} from '../../lib/appAccess';

describe('resolveAppState', () => {
  it('prioritizes email → onboarding → payment failed → billing → workspace → ready', () => {
    expect(resolveAppState({
      emailConfirmed: false,
      onboardingCompleted: false,
      billingState: 'NONE',
      workspaceState: 'NONE',
    })).toEqual({ state: 'EMAIL_PENDING', reason: 'EMAIL_UNCONFIRMED' });

    expect(resolveAppState({
      emailConfirmed: true,
      onboardingCompleted: false,
      billingState: 'NONE',
      workspaceState: 'NONE',
    })).toEqual({ state: 'ONBOARDING_REQUIRED', reason: 'ONBOARDING_INCOMPLETE' });

    expect(resolveAppState({
      emailConfirmed: true,
      onboardingCompleted: true,
      billingState: 'FAILED',
      workspaceState: 'READY',
    })).toEqual({ state: 'PAYMENT_FAILED', reason: 'INVOICE_PAYMENT_FAILED' });

    expect(resolveAppState({
      emailConfirmed: true,
      onboardingCompleted: true,
      billingState: 'NONE',
      workspaceState: 'SETUP',
    })).toEqual({ state: 'BILLING_REQUIRED', reason: 'NO_ACTIVE_ENTITLEMENT' });

    expect(resolveAppState({
      emailConfirmed: true,
      onboardingCompleted: true,
      billingState: 'TRIAL',
      workspaceState: 'SETUP',
    })).toEqual({ state: 'WORKSPACE_REQUIRED', reason: 'NO_READY_WORKSPACE' });

    expect(resolveAppState({
      emailConfirmed: true,
      onboardingCompleted: true,
      billingState: 'ACTIVE',
      workspaceState: 'READY',
    })).toEqual({ state: 'READY', reason: 'ENTITLED_WITH_READY_WORKSPACE' });
  });
});

describe('buildAccessSnapshot + redirect', () => {
  it('exposes schemaVersion, policyVersion, reason, and plans redirect when billing required', () => {
    const snap = buildAccessSnapshot({
      emailConfirmed: true,
      onboardingCompleted: true,
      billingState: 'NONE',
      workspaceState: 'SETUP',
      setupWorkspaceId: 18,
      now: new Date('2026-08-03T12:00:00.000Z'),
    });
    expect(snap.schemaVersion).toBe(1);
    expect(snap.policyVersion).toBe(1);
    expect(snap.generatedAt).toBe('2026-08-03T12:00:00.000Z');
    expect(snap.appState).toBe('BILLING_REQUIRED');
    expect(snap.reason).toBe('NO_ACTIVE_ENTITLEMENT');
    expect(snap.redirect).toEqual({
      redirect: '/plans',
      replace: true,
      reason: 'NO_ACTIVE_ENTITLEMENT',
    });
  });

  it('redirects workspace-required to existing setup or /workspace/new', () => {
    expect(resolveRedirect(
      { state: 'WORKSPACE_REQUIRED', reason: 'NO_READY_WORKSPACE' },
      { setupWorkspaceId: 18 },
    ).redirect).toBe('/workspace/18/setup');

    expect(resolveRedirect(
      { state: 'WORKSPACE_REQUIRED', reason: 'NO_READY_WORKSPACE' },
      {},
    ).redirect).toBe('/workspace/new');
  });
});

describe('AccessPolicy v1', () => {
  it('blocks App and WorkspaceSetup while BILLING_REQUIRED', () => {
    expect(allowsFrontend('BILLING_REQUIRED', '/plans')).toBe(true);
    expect(allowsFrontend('BILLING_REQUIRED', '/billing/checkout/growth')).toBe(true);
    expect(allowsFrontend('BILLING_REQUIRED', '/billing/confirmation/success')).toBe(true);
    expect(allowsFrontend('BILLING_REQUIRED', '/dashboard')).toBe(false);
    expect(allowsFrontend('BILLING_REQUIRED', '/workspace/18/setup')).toBe(false);
    expect(allowsApi('BILLING_REQUIRED', 'POST:/api/workspaces/setup')).toBe(false);
    expect(allowsApi('BILLING_REQUIRED', 'POST:/api/billing/create-subscription')).toBe(true);
  });

  it('allows recovery routes while PAYMENT_FAILED', () => {
    expect(allowsFrontend('PAYMENT_FAILED', '/billing/confirmation/failed')).toBe(true);
    expect(allowsFrontend('PAYMENT_FAILED', '/settings/billing_subscription')).toBe(true);
    expect(allowsFrontend('PAYMENT_FAILED', '/dashboard')).toBe(false);
  });
});

describe('projectors', () => {
  it('projects billing and workspace states', () => {
    expect(projectBillingState({
      subscriptionStatus: 'trialing',
      paymentFailedLocked: false,
    })).toBe('TRIAL');
    expect(projectBillingState({
      subscriptionStatus: 'active',
      paymentFailedLocked: true,
    })).toBe('FAILED');
    expect(projectBillingState({
      subscriptionStatus: 'active',
      paymentFailedLocked: false,
      cancelAtPeriodEnd: true,
      currentPeriodEnd: '2020-01-01T00:00:00.000Z',
    })).toBe('NONE');
    expect(projectWorkspaceState({ readyCount: 0, setupId: 18 })).toBe('SETUP');
    expect(projectWorkspaceState({ readyCount: 1, setupId: 18 })).toBe('READY');
  });
});

describe('redirectLoopKey', () => {
  it('is stable for identical hops', () => {
    expect(redirectLoopKey('BILLING_REQUIRED', 'NO_ACTIVE_ENTITLEMENT', '/dashboard', '/plans'))
      .toBe('BILLING_REQUIRED:NO_ACTIVE_ENTITLEMENT:/dashboard:/plans');
  });
});
