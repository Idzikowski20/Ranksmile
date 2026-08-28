import db from '@/database/database';
import { ensureArticlesTables } from '@/src/infrastructure/persistence/schema/ensureArticlesTables';
import { getConfirmationStatus } from '@/src/infrastructure/emailConfirmation';
import { getCallerRole } from '@/src/infrastructure/members';
import {
  listWorkspaces,
  createSetupWorkspace,
  findSetupWorkspaceId,
  type Workspace,
} from '@/src/infrastructure/workspaces';
import { getOrgBillingState } from '@/src/infrastructure/orgBilling';
import { grantedAccessAtSomePoint } from '@/src/infrastructure/billing/billingEverSubscribed';
import { ensureUserTenancy } from '@/src/infrastructure/tenancy';
import { isPaymentFailedLocked } from '@/src/infrastructure/paymentFailedLock';
import {
  buildAccessSnapshot,
  projectBillingState,
  projectWorkspaceState,
  type AccessSnapshot,
} from '@/src/infrastructure/appAccess/index';

export type BootstrapData = {
  onboarding: { completed: boolean };
  email: { confirmed: boolean; email: string | null };
  workspaces: Workspace[];
  activeId: number | null;
  role: string | null;
  setupWorkspaceId: number | null;
  canCreateSetup: boolean;
  /** @deprecated Prefer access.redirect.redirect — kept for cold-start callers */
  redirectTo: string | null;
  access: AccessSnapshot;
  userId?: string;
};

export type GetBootstrapOptions = {
  activeWorkspaceCookie?: string;
  /** Compute redirectTo / access.redirect for index / cold-start routing. */
  resolveRedirect?: boolean;
  /**
   * When resolveRedirect and app needs a setup workspace (entitled, no ready WS),
   * create/reuse setup. Never creates workspace before billing entitlement.
   */
  createSetupIfNeeded?: boolean;
};

async function getOnboardingCompleted(userId: string): Promise<boolean> {
  await ensureArticlesTables();
  const [rows] = await db.query(
    'SELECT completed FROM user_onboarding WHERE user_id = ?',
    { replacements: [userId] },
  ) as [Array<{ completed: number | boolean }>, unknown];
  return rows.length > 0 && !!Number(rows[0].completed);
}

function resolveActiveId(
  workspaces: Workspace[],
  cookie: string | undefined,
): number | null {
  const ids = workspaces.map((w) => w.id);
  if (cookie) {
    const id = Number(cookie);
    if (Number.isInteger(id) && id > 0 && ids.includes(id)) return id;
  }
  return workspaces[0]?.id ?? null;
}

/** Single source of truth for session bootstrap (GSSP, API, ApplicationShell). */
export async function getBootstrap(
  userId: string,
  opts: GetBootstrapOptions = {},
): Promise<BootstrapData> {
  const { orgId } = await ensureUserTenancy(userId);

  const [onboardingCompleted, emailStatus, workspaces, role, setupWorkspaceId, billing] = await Promise.all([
    getOnboardingCompleted(userId),
    getConfirmationStatus(userId),
    listWorkspaces(userId),
    getCallerRole(userId),
    findSetupWorkspaceId(userId),
    getOrgBillingState(orgId),
  ]);

  const canCreateSetup = role === 'owner' || role === 'admin';
  const activeId = resolveActiveId(workspaces, opts.activeWorkspaceCookie);

  const billingState = projectBillingState({
    subscriptionStatus: billing?.subscriptionStatus ?? null,
    paymentFailedLocked: isPaymentFailedLocked(billing),
    currentPeriodEnd: billing?.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: billing?.cancelAtPeriodEnd ?? false,
    trialEndsAt: billing?.trialEndsAt ?? null,
  });
  let workspaceState = projectWorkspaceState({
    readyCount: workspaces.length,
    setupId: setupWorkspaceId,
  });

  let setupId = setupWorkspaceId;

  // Only materialize setup workspace when billing already entitles the org.
  const entitled = billingState === 'TRIAL' || billingState === 'ACTIVE';
  if (
    opts.createSetupIfNeeded
    && opts.resolveRedirect
    && onboardingCompleted
    && emailStatus.confirmed
    && entitled
    && workspaces.length === 0
    && canCreateSetup
    && !setupId
  ) {
    setupId = await createSetupWorkspace(userId);
    workspaceState = projectWorkspaceState({
      readyCount: workspaces.length,
      setupId,
    });
  }

  const access = buildAccessSnapshot({
    emailConfirmed: emailStatus.confirmed,
    onboardingCompleted,
    billingState,
    billingSince: billing?.paymentFailedLockedAt
      ?? billing?.trialEndsAt
      ?? billing?.currentPeriodEnd
      ?? null,
    // What separates "your plan expired" from "you have not picked one yet" — both land
    // in BILLING_REQUIRED. The subscription id alone was counted, and checkout writes one
    // with status `incomplete` before any money moves, so abandoning a first checkout told
    // a user who never paid that their plan had expired.
    everSubscribed: grantedAccessAtSomePoint(billing),
    workspaceState,
    setupWorkspaceId: setupId,
    activeWorkspaceId: activeId,
    canCreateSetup,
  });

  const base: BootstrapData = {
    onboarding: { completed: onboardingCompleted },
    email: { confirmed: emailStatus.confirmed, email: emailStatus.email },
    workspaces,
    activeId,
    role,
    setupWorkspaceId: setupId,
    canCreateSetup,
    redirectTo: opts.resolveRedirect ? access.redirect.redirect : null,
    access,
  };

  return base;
}
