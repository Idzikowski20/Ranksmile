import db from '../database/database';
import { ensureArticlesTables } from './ensureArticlesTables';
import { getConfirmationStatus } from './emailConfirmation';
import { getCallerRole } from './members';
import {
  listWorkspaces,
  createSetupWorkspace,
  findSetupWorkspaceId,
  type Workspace,
} from './workspaces';

export type BootstrapData = {
  onboarding: { completed: boolean };
  email: { confirmed: boolean; email: string | null };
  workspaces: Workspace[];
  activeId: number | null;
  role: string | null;
  setupWorkspaceId: number | null;
  canCreateSetup: boolean;
  redirectTo: string | null;
  userId?: string;
};

export type GetBootstrapOptions = {
  activeWorkspaceCookie?: string;
  /** Compute redirectTo for index / cold-start routing. */
  resolveRedirect?: boolean;
  /** When resolveRedirect and user needs setup, create the setup workspace (index GSSP only). */
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

function computeRedirect(
  data: Pick<BootstrapData, 'onboarding' | 'email' | 'workspaces' | 'activeId' | 'role' | 'canCreateSetup' | 'setupWorkspaceId'>,
  setupIdForRedirect: number | null,
): string | null {
  if (!data.email.confirmed) return '/auth/confirm-account';
  if (!data.onboarding.completed) return '/onboarding';
  if (data.workspaces.length > 0) {
    const wsId = data.activeId ?? data.workspaces[0].id;
    return `/workspace/${wsId}/dashboard`;
  }
  if (!data.canCreateSetup) return '/no-access';
  if (setupIdForRedirect) return `/workspace/${setupIdForRedirect}/setup`;
  return '/onboarding';
}

/** Single source of truth for session bootstrap (GSSP, API, guards). */
export async function getBootstrap(
  userId: string,
  opts: GetBootstrapOptions = {},
): Promise<BootstrapData> {
  const [onboardingCompleted, emailStatus, workspaces, role, setupWorkspaceId] = await Promise.all([
    getOnboardingCompleted(userId),
    getConfirmationStatus(userId),
    listWorkspaces(userId),
    getCallerRole(userId),
    findSetupWorkspaceId(userId),
  ]);

  const canCreateSetup = role === 'owner' || role === 'admin';
  const activeId = resolveActiveId(workspaces, opts.activeWorkspaceCookie);

  const base: BootstrapData = {
    onboarding: { completed: onboardingCompleted },
    email: { confirmed: emailStatus.confirmed, email: emailStatus.email },
    workspaces,
    activeId,
    role,
    setupWorkspaceId,
    canCreateSetup,
    redirectTo: null,
  };

  if (!opts.resolveRedirect) return base;

  let setupIdForRedirect = setupWorkspaceId;
  if (
    onboardingCompleted
    && emailStatus.confirmed
    && workspaces.length === 0
    && canCreateSetup
    && !setupIdForRedirect
    && opts.createSetupIfNeeded
  ) {
    setupIdForRedirect = await createSetupWorkspace(userId);
    base.setupWorkspaceId = setupIdForRedirect;
  }

  base.redirectTo = computeRedirect(base, setupIdForRedirect);
  return base;
}
