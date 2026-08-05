import type { AccessRedirect, AppState, AppStateReason, ResolvedAppState } from './types';

export type ResolveRedirectContext = {
  activeWorkspaceId?: number | null;
  setupWorkspaceId?: number | null;
};

/**
 * Canonical gate redirect for an app state. Pure — no router.
 */
export function resolveRedirect(
  resolved: ResolvedAppState,
  ctx: ResolveRedirectContext = {},
): AccessRedirect {
  const reason = resolved.reason;
  const replace = true;

  switch (resolved.state) {
    case 'EMAIL_PENDING':
      return { redirect: '/auth/confirm-account', replace, reason };
    case 'ONBOARDING_REQUIRED':
      return { redirect: '/onboarding', replace, reason };
    case 'BILLING_REQUIRED':
      return { redirect: '/plans', replace, reason };
    case 'PAYMENT_FAILED':
      return { redirect: '/billing/confirmation/failed', replace, reason };
    case 'LOCKED':
      return { redirect: '/no-access', replace, reason };
    case 'WORKSPACE_REQUIRED': {
      if (reason === 'NO_SETUP_PERMISSION') {
        return { redirect: '/no-access', replace, reason };
      }
      const setupId = ctx.setupWorkspaceId;
      if (setupId != null && setupId > 0) {
        return { redirect: `/workspace/${setupId}/setup`, replace, reason };
      }
      return { redirect: '/workspace/new', replace, reason };
    }
    case 'READY': {
      const wsId = ctx.activeWorkspaceId;
      if (wsId != null && wsId > 0) {
        return { redirect: `/workspace/${wsId}/dashboard`, replace, reason };
      }
      return { redirect: '/dashboard', replace, reason };
    }
    default: {
      const _exhaustive: never = resolved.state;
      return { redirect: '/plans', replace, reason: reason as AppStateReason };
      void _exhaustive;
    }
  }
}

/** Stable key for redirect loop detection. */
export function redirectLoopKey(
  appState: AppState,
  reason: AppStateReason,
  fromPath: string,
  toPath: string,
): string {
  return `${appState}:${reason}:${fromPath}:${toPath}`;
}
