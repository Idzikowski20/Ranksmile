/**
 * Application Access State — pure types for Access Snapshot.
 * @see docs/adr/2026-08-03-application-access-state.md
 */

export const ACCESS_SCHEMA_VERSION = 1 as const;
export const ACCESS_POLICY_VERSION = 1 as const;

export type AppState =
  | 'EMAIL_PENDING'
  | 'ONBOARDING_REQUIRED'
  | 'BILLING_REQUIRED'
  | 'WORKSPACE_REQUIRED'
  | 'READY'
  | 'PAYMENT_FAILED'
  | 'LOCKED';

export type AppStateReason =
  | 'EMAIL_UNCONFIRMED'
  | 'ONBOARDING_INCOMPLETE'
  | 'NO_ACTIVE_ENTITLEMENT'
  | 'NO_READY_WORKSPACE'
  | 'ENTITLED_WITH_READY_WORKSPACE'
  | 'INVOICE_PAYMENT_FAILED'
  | 'HARD_LOCKED'
  | 'NO_SETUP_PERMISSION';

export type BillingState = 'NONE' | 'TRIAL' | 'ACTIVE' | 'FAILED' | 'LOCKED';

export type WorkspaceState = 'NONE' | 'SETUP' | 'READY';

export type RouteCapability =
  | 'Public'
  | 'Auth'
  | 'Onboarding'
  | 'BillingCheckout'
  | 'BillingSuccess'
  | 'BillingRecovery'
  | 'BillingRead'
  | 'BillingManage'
  | 'WorkspaceSetup'
  | 'App'
  | 'Health'
  | 'Webhook'
  | 'Plans';

export type AccessRedirect = {
  redirect: string;
  replace: boolean;
  reason: AppStateReason;
};

export type AccessSnapshot = {
  schemaVersion: typeof ACCESS_SCHEMA_VERSION;
  generatedAt: string;
  policyVersion: typeof ACCESS_POLICY_VERSION;
  appState: AppState;
  reason: AppStateReason;
  billing: {
    state: BillingState;
    since?: string | null;
  };
  workspace: {
    state: WorkspaceState;
    setupId?: number | null;
    activeId?: number | null;
    since?: string | null;
  };
  redirect: AccessRedirect;
  meta?: { appStateSince?: string | null };
};

export type ResolveAppStateInput = {
  emailConfirmed: boolean;
  onboardingCompleted: boolean;
  billingState: BillingState;
  workspaceState: WorkspaceState;
  /** Hard org lock (future); when true → LOCKED */
  hardLocked?: boolean;
  canCreateSetup?: boolean;
};

export type ResolvedAppState = {
  state: AppState;
  reason: AppStateReason;
};
