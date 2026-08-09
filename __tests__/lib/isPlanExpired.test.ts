/** @jest-environment node */
import { isPlanExpired } from '../../lib/appAccess/isPlanExpired';
import type { AccessSnapshot, AppState, BillingState } from '../../lib/appAccess/types';

function snapshot(
  appState: AppState,
  billing: { state: BillingState; everSubscribed?: boolean },
): AccessSnapshot {
  return {
    schemaVersion: 1,
    generatedAt: '2026-08-09T00:00:00.000Z',
    policyVersion: 1,
    appState,
    reason: 'NO_ACTIVE_ENTITLEMENT',
    billing: { state: billing.state, since: null, everSubscribed: billing.everSubscribed },
    workspace: { state: 'READY', setupId: null, activeId: 1, since: null },
    redirect: { redirect: '/plans', replace: true, reason: 'NO_ACTIVE_ENTITLEMENT' },
  } as AccessSnapshot;
}

describe('isPlanExpired', () => {
  it('blocks an account whose subscription or trial lapsed', () => {
    expect(isPlanExpired(snapshot('BILLING_REQUIRED', { state: 'NONE', everSubscribed: true })))
      .toBe(true);
  });

  // The whole reason the flag exists: BILLING_REQUIRED also holds people who have
  // simply never picked a plan, and they must keep the /plans redirect.
  it('leaves an account that never subscribed alone', () => {
    expect(isPlanExpired(snapshot('BILLING_REQUIRED', { state: 'NONE', everSubscribed: false })))
      .toBe(false);
    expect(isPlanExpired(snapshot('BILLING_REQUIRED', { state: 'NONE' })))
      .toBe(false);
  });

  it('does not fire while access is still good', () => {
    expect(isPlanExpired(snapshot('READY', { state: 'ACTIVE', everSubscribed: true }))).toBe(false);
    expect(isPlanExpired(snapshot('READY', { state: 'TRIAL', everSubscribed: true }))).toBe(false);
  });

  // A failed card has its own recovery flow; it is not an expiry.
  it('does not hijack PAYMENT_FAILED', () => {
    expect(isPlanExpired(snapshot('PAYMENT_FAILED', { state: 'FAILED', everSubscribed: true })))
      .toBe(false);
  });

  // LOCKED is unreachable — nothing sets hardLocked — so gating on it never fired.
  it('does not rely on LOCKED, which nothing produces', () => {
    expect(isPlanExpired(snapshot('LOCKED', { state: 'LOCKED', everSubscribed: true }))).toBe(false);
  });
});
