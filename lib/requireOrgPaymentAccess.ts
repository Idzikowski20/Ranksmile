import type { NextApiHandler, NextApiRequest, NextApiResponse } from 'next';
import { getCurrentUserId } from '../utils/getUser';
import { isApiRouteAllowedDuringPaymentLock } from './paymentFailedLock';

const LOCKED_BODY = {
  code: 'PAYMENT_FAILED_LOCKED',
  message: 'Payment failed lock is active. Update your billing settings to restore access.',
} as const;

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
  | { kind: 'org'; orgId: number }
  | { kind: 'none' }
  | { kind: 'unavailable' };

async function resolveOrgId(req: NextApiRequest, res: NextApiResponse): Promise<ResolvedOrg> {
  const userId = await getCurrentUserId(req, res).catch(() => null);
  if (userId) {
    try {
      const { ensureUserTenancy } = await import('./tenancy');
      return { kind: 'org', orgId: (await ensureUserTenancy(userId)).orgId };
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
    const [rows] = await db.query('SELECT org_id FROM workspaces WHERE id = ? LIMIT 1', {
      replacements: [conn.workspace_id],
    });
    const orgId = Number((rows as { org_id: number | string }[])[0]?.org_id);
    if (!Number.isFinite(orgId) || orgId <= 0) return { kind: 'unavailable' };
    return { kind: 'org', orgId };
  } catch {
    return { kind: 'unavailable' };
  }
}

export function withOrgPaymentAccess(handler: NextApiHandler): NextApiHandler {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const urlPath = typeof req.url === 'string' ? (req.url.split('?')[0] ?? '') : '';
    const method = req.method ?? '';

    if (urlPath === '/api/webhooks/stripe') {
      return handler(req, res);
    }

    const routeKey = urlPath && method ? `${method}:${urlPath}` : '';
    if (routeKey && isApiRouteAllowedDuringPaymentLock(routeKey)) {
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
      const { getOrgBillingState } = await import('./orgBilling');
      const billing = await getOrgBillingState(resolved.orgId);
      if (billing?.paymentFailedLockedAt != null) {
        return res.status(402).json(LOCKED_BODY);
      }
    } catch {
      return res.status(503).json(UNAVAILABLE_BODY);
    }

    return handler(req, res);
  };
}
