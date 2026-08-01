import type { NextApiRequest, NextApiResponse } from 'next';
import { getCurrentUserId } from './getUser';
import { logLegacyApiKeyUse } from '../lib/legacyApiKeyLog';

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
  const verifiedAPI = Boolean(
    apiKey
    && req.headers.authorization
    && req.headers.authorization.substring('Bearer '.length) === apiKey,
  );

  if (verifiedAPI && accessingAllowedRoute) {
    void logLegacyApiKeyUse({
      endpoint: routeKey(req) || 'unknown',
      ip: clientIp(req),
    });
    return 'authorized';
  }
  if (verifiedAPI && !accessingAllowedRoute) return 'This Route cannot be accessed with API.';
  // Don't treat CRON_SECRET Bearer as "Invalid API Key" — leave to route handlers.
  if (req.headers.authorization?.startsWith('Bearer ') && apiKey && !verifiedAPI) {
    const token = req.headers.authorization.substring('Bearer '.length);
    if (token === apiKey) return 'Invalid API Key Provided.';
    // Other bearers (cron secrets, etc.): fall through to session check
  }

  const userId = await getCurrentUserId(req, res);
  if (userId) return 'authorized';

  return 'Not authorized';
};

export default verifyUser;
