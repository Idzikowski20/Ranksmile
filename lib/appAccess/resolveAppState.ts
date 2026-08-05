import type {
  BillingState,
  ResolveAppStateInput,
  ResolvedAppState,
  WorkspaceState,
} from './types';
import { hasActiveBillingEntitlement } from '../billingEntitlement';
import type { SubscriptionStatus } from '../orgBilling';

/**
 * Priority: LOCKED → EMAIL → ONBOARDING → PAYMENT_FAILED → BILLING → WORKSPACE → READY
 */
export function resolveAppState(input: ResolveAppStateInput): ResolvedAppState {
  if (input.hardLocked || input.billingState === 'LOCKED') {
    return { state: 'LOCKED', reason: 'HARD_LOCKED' };
  }
  if (!input.emailConfirmed) {
    return { state: 'EMAIL_PENDING', reason: 'EMAIL_UNCONFIRMED' };
  }
  if (!input.onboardingCompleted) {
    return { state: 'ONBOARDING_REQUIRED', reason: 'ONBOARDING_INCOMPLETE' };
  }
  if (input.billingState === 'FAILED') {
    return { state: 'PAYMENT_FAILED', reason: 'INVOICE_PAYMENT_FAILED' };
  }
  if (input.billingState === 'NONE') {
    return { state: 'BILLING_REQUIRED', reason: 'NO_ACTIVE_ENTITLEMENT' };
  }
  // TRIAL | ACTIVE
  if (input.workspaceState !== 'READY') {
    if (input.canCreateSetup === false && input.workspaceState === 'NONE') {
      return { state: 'WORKSPACE_REQUIRED', reason: 'NO_SETUP_PERMISSION' };
    }
    return { state: 'WORKSPACE_REQUIRED', reason: 'NO_READY_WORKSPACE' };
  }
  return { state: 'READY', reason: 'ENTITLED_WITH_READY_WORKSPACE' };
}

export function projectBillingState(args: {
  subscriptionStatus: string | null | undefined;
  paymentFailedLocked: boolean;
  hardLocked?: boolean;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd?: boolean;
}): BillingState {
  if (args.hardLocked) return 'LOCKED';
  if (args.paymentFailedLocked) return 'FAILED';
  const status = args.subscriptionStatus ?? null;
  if (!hasActiveBillingEntitlement({
    subscriptionStatus: status as SubscriptionStatus | null,
    currentPeriodEnd: args.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: args.cancelAtPeriodEnd ?? false,
  })) return 'NONE';
  if (status === 'trialing') return 'TRIAL';
  if (status === 'active' || status === 'past_due' || status === 'unpaid') return 'ACTIVE';
  return 'NONE';
}

export function projectWorkspaceState(args: {
  readyCount: number;
  setupId: number | null;
}): WorkspaceState {
  if (args.readyCount > 0) return 'READY';
  if (args.setupId != null) return 'SETUP';
  return 'NONE';
}
