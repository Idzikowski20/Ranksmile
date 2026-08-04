import {
  ACCESS_POLICY_VERSION,
  ACCESS_SCHEMA_VERSION,
  type AccessSnapshot,
  type BillingState,
  type WorkspaceState,
} from './types';
import { resolveAppState } from './resolveAppState';
import { resolveRedirect } from './resolveRedirect';

export type BuildAccessSnapshotInput = {
  emailConfirmed: boolean;
  onboardingCompleted: boolean;
  billingState: BillingState;
  billingSince?: string | null;
  workspaceState: WorkspaceState;
  setupWorkspaceId?: number | null;
  activeWorkspaceId?: number | null;
  workspaceSince?: string | null;
  hardLocked?: boolean;
  canCreateSetup?: boolean;
  now?: Date;
};

export function buildAccessSnapshot(input: BuildAccessSnapshotInput): AccessSnapshot {
  const generatedAt = (input.now ?? new Date()).toISOString();
  const resolved = resolveAppState({
    emailConfirmed: input.emailConfirmed,
    onboardingCompleted: input.onboardingCompleted,
    billingState: input.billingState,
    workspaceState: input.workspaceState,
    hardLocked: input.hardLocked,
    canCreateSetup: input.canCreateSetup,
  });
  const redirect = resolveRedirect(resolved, {
    activeWorkspaceId: input.activeWorkspaceId,
    setupWorkspaceId: input.setupWorkspaceId,
  });

  return {
    schemaVersion: ACCESS_SCHEMA_VERSION,
    generatedAt,
    policyVersion: ACCESS_POLICY_VERSION,
    appState: resolved.state,
    reason: resolved.reason,
    billing: {
      state: input.billingState,
      since: input.billingSince ?? null,
    },
    workspace: {
      state: input.workspaceState,
      setupId: input.setupWorkspaceId ?? null,
      activeId: input.activeWorkspaceId ?? null,
      since: input.workspaceSince ?? null,
    },
    redirect,
    meta: { appStateSince: generatedAt },
  };
}
