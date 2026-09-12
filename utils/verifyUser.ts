import type { NextApiRequest, NextApiResponse } from 'next';
import { getCurrentUserId, wasAuthUnavailable } from './getUser';
import { logLegacyApiKeyUse } from '@/src/infrastructure/config/legacyApiKeyLog';
import { timingSafeEqualText } from '@/src/infrastructure/crypto/timingSafeEqualText';

const ALLOWED_APIKEY_ROUTES = [
  'GET:/api/keyword',
  'GET:/api/keywords',
  'GET:/api/domains',
  'POST:/api/refresh',
  'POST:/api/cron',
  'POST:/api/notify',
  'POST:/api/searchconsole',
  'GET:/api/searchconsole',
  'POST:/api/gsc/search-data',
  'GET:/api/gsc/search-data',
  'GET:/api/insight',
] as const;

function clientIp(req: NextApiRequest): string | undefined {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.trim()) return xf.split(',')[0]?.trim();
  if (Array.isArray(xf) && xf[0]) return xf[0];
  return req.socket?.remoteAddress;
}

function routeKey(req: NextApiRequest): string | null {
  if (!req.url || !req.method) return null;
  return `${req.method}:${req.url.replace(/\?(.*)/, '')}`;
}

function bearerToken(req: NextApiRequest): string | null {
  const auth = req.headers.authorization;
  if (typeof auth !== 'string' || !auth.startsWith('Bearer ')) return null;
  const token = auth.slice('Bearer '.length);
  return token || null;
}

/**
 * Verifies Neon Auth session, or (deprecated) install-wide APIKEY on a whitelist.
 * Basic USER/PASSWORD auth removed — multi-tenant SaaS only.
 */
const verifyUser = async (req: NextApiRequest, res: NextApiResponse): Promise<string> => {
  const accessingAllowedRoute = (() => {
    const key = routeKey(req);
    return key ? (ALLOWED_APIKEY_ROUTES as readonly string[]).includes(key) : false;
  })();

  const apiKey = process.env.APIKEY?.trim();
  const token = bearerToken(req);
  const verifiedAPI = Boolean(apiKey && token && timingSafeEqualText(token, apiKey));

  if (verifiedAPI && accessingAllowedRoute) {
    void logLegacyApiKeyUse({
      endpoint: routeKey(req) || 'unknown',
      ip: clientIp(req),
    });
    return 'authorized';
  }
  if (verifiedAPI && !accessingAllowedRoute) return 'This Route cannot be accessed with API.';
  // Don't treat CRON_SECRET Bearer as "Invalid API Key" — leave to route handlers.
  if (token && apiKey && !verifiedAPI) {
    // Other bearers (cron secrets, etc.): fall through to session check
  }

  const userId = await getCurrentUserId(req, res);
  if (userId) return 'authorized';

  // The auth server being down is not a verdict about this user. Saying "Not
  // authorized" for an infrastructure failure sent people chasing their session;
  // the honest message names the real problem and that retrying will fix it.
  if (wasAuthUnavailable(req)) return 'Authentication service unavailable — please try again';
  return 'Not authorized';
};

export default verifyUser;
