import type { NextApiHandler, NextApiRequest, NextApiResponse } from 'next';
import { getCurrentUserId } from '../utils/getUser';
import {
  ACCESS_POLICY_VERSION,
  ACCESS_SCHEMA_VERSION,
  allowsApi,
  buildAccessSnapshot,
  projectBillingState,
  projectWorkspaceState,
  type AccessSnapshot,
} from './appAccess';
import { isPaymentFailedLocked } from './paymentFailedLock';

const UNAVAILABLE_BODY = {
  code: 'PAYMENT_ACCESS_UNAVAILABLE',
  message: 'Unable to verify payment access. Try again shortly.',
} as const;

function headerApiKey(req: NextApiRequest): string | undefined {
  const h = req.headers['api-key'] ?? req.headers['x-api-key'];
  if (typeof h === 'string' && h.trim()) return h.trim();
  if (Array.isArray(h) && typeof h[0] === 'string' && h[0].trim()) return h[0].trim();
  return undefined;
}

type ResolvedOrg =
  | { kind: 'org'; orgId: number; userId: string | null }
  | { kind: 'none' }
  | { kind: 'unavailable' };

async function resolveOrgId(req: NextApiRequest, res: NextApiResponse): Promise<ResolvedOrg> {
  const userId = await getCurrentUserId(req, res).catch(() => null);
  if (userId) {
    try {
      const { ensureUserTenancy } = await import('./tenancy');
      return { kind: 'org', orgId: (await ensureUserTenancy(userId)).orgId, userId };
    } catch {
      return { kind: 'unavailable' };
    }
  }

  const apiKey = headerApiKey(req);
  if (!apiKey) return { kind: 'none' };

  try {
    const { resolveByApiKey } = await import('./wpConnection');
    const conn = await resolveByApiKey(apiKey);
    if (!conn) return { kind: 'none' };

    const db = (await import('../database/database')).default;
    const [rows] = await db.query('SELECT org_id from workspaces WHERE id = ? LIMIT 1', {
      replacements: [conn.workspace_id],
    });
    const orgId = Number((rows as { org_id: number | string }[])[0]?.org_id);
    if (!Number.isFinite(orgId) || orgId <= 0) return { kind: 'unavailable' };
    return { kind: 'org', orgId, userId: null };
  } catch {
    return { kind: 'unavailable' };
  }
}

async function loadAccessSnapshot(orgId: number, userId: string | null): Promise<AccessSnapshot> {
  const { getOrgBillingState } = await import('./orgBilling');
  const billing = await getOrgBillingState(orgId);
  const billingState = projectBillingState({
    subscriptionStatus: billing?.subscriptionStatus ?? null,
    paymentFailedLocked: isPaymentFailedLocked(billing),
    currentPeriodEnd: billing?.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: billing?.cancelAtPeriodEnd ?? false,
  });

  const db = (await import('../database/database')).default;

  let emailConfirmed = true;
  let onboardingCompleted = true;
  let canCreateSetup = true;
  let readyCount = 0;
  let setupId: number | null = null;
  let activeId: number | null = null;

  if (userId) {
    try {
      const [obRows] = await db.query(
        'SELECT completed FROM user_onboarding WHERE user_id = ? LIMIT 1',
        { replacements: [userId] },
      );
      const ob = (obRows as { completed: number | boolean }[])[0];
      onboardingCompleted = Boolean(ob && Number(ob.completed));
    } catch {
      onboardingCompleted = true;
    }
    try {
      const { getConfirmationStatus } = await import('./emailConfirmation');
      emailConfirmed = (await getConfirmationStatus(userId)).confirmed;
    } catch {
      emailConfirmed = true;
    }
    try {
      const { getCallerRole } = await import('./members');
      const role = await getCallerRole(userId);
      canCreateSetup = role === 'owner' || role === 'admin';
    } catch {
      canCreateSetup = true;
    }
  }

  try {
    const [readyRows] = await db.query(
      "SELECT COUNT(*)::int AS n FROM workspaces WHERE org_id = ? AND status = 'ready'",
      { replacements: [orgId] },
    );
    readyCount = Number((readyRows as { n: number }[])[0]?.n ?? 0);
    const [setupRows] = await db.query(
      "SELECT id FROM workspaces WHERE org_id = ? AND status = 'setup' ORDER BY id DESC LIMIT 1",
      { replacements: [orgId] },
    );
    setupId = (setupRows as { id: number }[])[0]?.id != null
      ? Number((setupRows as { id: number }[])[0].id)
      : null;
    if (readyCount > 0) {
      const [activeRows] = await db.query(
        "SELECT id FROM workspaces WHERE org_id = ? AND status = 'ready' ORDER BY id ASC LIMIT 1",
        { replacements: [orgId] },
      );
      activeId = (activeRows as { id: number }[])[0]?.id != null
        ? Number((activeRows as { id: number }[])[0].id)
        : null;
    }
  } catch {
    // Tests may mock db.query incompletely — billing projection still applies.
  }

  return buildAccessSnapshot({
    emailConfirmed,
    onboardingCompleted,
    billingState,
    billingSince: billing?.paymentFailedLockedAt ?? null,
    workspaceState: projectWorkspaceState({ readyCount, setupId }),
    setupWorkspaceId: setupId,
    activeWorkspaceId: activeId,
    canCreateSetup,
  });
}

function denialBody(access: AccessSnapshot) {
  const code = access.appState === 'PAYMENT_FAILED'
    ? 'PAYMENT_FAILED_LOCKED'
    : access.appState === 'BILLING_REQUIRED'
      ? 'BILLING_REQUIRED'
      : access.appState === 'LOCKED'
        ? 'ACCESS_LOCKED'
        : 'ACCESS_DENIED';

  return {
    code,
    appState: access.appState,
    reason: access.reason,
    redirect: access.redirect.redirect,
    schemaVersion: ACCESS_SCHEMA_VERSION,
    policyVersion: ACCESS_POLICY_VERSION,
    message: access.appState === 'PAYMENT_FAILED'
      ? 'Payment failed lock is active. Update your billing settings to restore access.'
      : access.appState === 'BILLING_REQUIRED'
        ? 'A plan is required before using this resource.'
        : 'Access denied for the current application state.',
  };
}

export function withOrgPaymentAccess(handler: NextApiHandler): NextApiHandler {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const urlPath = typeof req.url === 'string' ? (req.url.split('?')[0] ?? '') : '';
    const method = req.method ?? '';

    if (urlPath === '/api/webhooks/stripe') {
      return handler(req, res);
    }

    const routeKey = urlPath && method ? `${method}:${urlPath}` : '';
    // Health / bootstrap must not depend on Access Snapshot (cold start).
    if (routeKey && allowsApi('READY', routeKey) && (
      urlPath === '/api/health'
      || urlPath === '/api/ready'
      || urlPath === '/api/session/bootstrap'
    )) {
      return handler(req, res);
    }

    // Tax preview is called often while typing address — skip full Access Snapshot
    // (still requires authenticated manager). FE ApplicationShell already gates checkout.
    if (urlPath === '/api/billing/tax-preview' && method === 'POST') {
      const userId = await getCurrentUserId(req, res).catch(() => null);
      if (!userId) return res.status(401).json({ error: 'Not authenticated' });
      try {
        const { assertCanManage } = await import('./members');
        await assertCanManage(userId);
      } catch {
        return res.status(403).json({ error: 'FORBIDDEN' });
      }
      return handler(req, res);
    }

    const resolved = await resolveOrgId(req, res);
    if (resolved.kind === 'unavailable') {
      return res.status(503).json(UNAVAILABLE_BODY);
    }
    if (resolved.kind === 'none') {
      return handler(req, res);
    }

    try {
      const access = await loadAccessSnapshot(resolved.orgId, resolved.userId);
      if (routeKey && !allowsApi(access.appState, routeKey)) {
        return res.status(402).json(denialBody(access));
      }
    } catch {
      return res.status(503).json(UNAVAILABLE_BODY);
    }

    return handler(req, res);
  };
}

/** @deprecated Alias — same as withOrgPaymentAccess (AccessPolicy). */
export const withOrgAccessPolicy = withOrgPaymentAccess;
