/**
 * Neon Auth proxy for Pages Router.
 * Forwards all /api/auth/* requests to the Neon Auth upstream server,
 * then relays the response (including Set-Cookie headers) back to the client.
 *
 * CORS: Neon reflects any Origin + credentials. Strip those headers and only
 * re-emit ACAO for known app origins (defense in depth vs credentialed XSS).
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { getAppOrigin } from '../../../lib/appOrigin';

const BASE_URL = process.env.NEON_AUTH_BASE_URL;

const STRIP_FROM_UPSTREAM = new Set([
  'transfer-encoding',
  'access-control-allow-origin',
  'access-control-allow-credentials',
  'access-control-allow-headers',
  'access-control-allow-methods',
  'access-control-expose-headers',
]);

function allowedAuthOrigins(req: NextApiRequest): Set<string> {
  const origins = new Set<string>();
  const app = getAppOrigin(req);
  if (app) origins.add(app);
  origins.add('https://ranksmile.pl');
  origins.add('https://www.ranksmile.pl');
  if (process.env.NODE_ENV !== 'production') {
    origins.add('http://localhost:3000');
    origins.add('http://127.0.0.1:3000');
  }
  return origins;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   if (!BASE_URL) {
      res.status(503).json({ error: 'NEON_AUTH_BASE_URL not configured' });
      return;
   }

   const pathParts = Array.isArray(req.query.auth0)
      ? req.query.auth0
      : [req.query.auth0 as string];
   const path = pathParts.join('/');
   const upstreamUrl = `${BASE_URL}/${path}`;

   const headers: Record<string, string> = {
      'content-type': 'application/json',
   };
   if (req.headers.cookie) { headers.cookie = req.headers.cookie; }
   if (req.headers.authorization) { headers.authorization = req.headers.authorization as string; }
   if (req.headers.origin) { headers.origin = req.headers.origin as string; }

   const hasBody = req.method !== 'GET' && req.method !== 'HEAD' && req.body != null;
   let body: string | undefined;
   if (hasBody) {
      body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
   }

   try {
      const response = await fetch(upstreamUrl, {
         method: req.method,
         headers,
         body,
      });

      response.headers.forEach((value, key) => {
         if (!STRIP_FROM_UPSTREAM.has(key.toLowerCase())) {
            res.setHeader(key, value);
         }
      });

      const origin = typeof req.headers.origin === 'string' ? req.headers.origin : '';
      if (origin && allowedAuthOrigins(req).has(origin)) {
         res.setHeader('Access-Control-Allow-Origin', origin);
         res.setHeader('Access-Control-Allow-Credentials', 'true');
         res.setHeader('Vary', 'Origin');
      }

      res.status(response.status);
      const buffer = await response.arrayBuffer();
      res.end(Buffer.from(buffer));
   } catch (err) {
      console.error('[neon-auth proxy] error:', err);
      res.status(502).json({ error: 'Auth upstream unavailable' });
   }
}
