/**
 * Neon Auth proxy for Pages Router.
 * Forwards all /api/auth/* requests to the Neon Auth upstream server,
 * then relays the response (including Set-Cookie headers) back to the client.
 *
 * CORS: Neon reflects any Origin + credentials. Strip those headers and only
 * re-emit ACAO for known app origins (defense in depth vs credentialed XSS).
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { getAppOrigin } from '@/src/infrastructure/config/appOrigin';

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

/**
 * Undo the spec's comma-joining of repeated Set-Cookie headers.
 *
 * A plain `split(',')` is wrong: an `Expires=Sat, 16 Aug 2026 …` date carries its own
 * comma. A boundary between two cookies is a comma followed by the next cookie's
 * `name=`, which a date's remainder (` 16 Aug …`) never is.
 */
function splitSetCookie(combined: string | null): string[] {
   if (!combined) return [];
   return combined.split(/,\s*(?=[^;,\s]+=)/).map((c) => c.trim()).filter(Boolean);
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

      // Set-Cookie is the one header that legitimately repeats, and `res.setHeader`
      // OVERWRITES rather than appends — so relaying it inside this loop kept only
      // whichever cookie the upstream happened to emit last. Sign-in sends the session
      // token alongside `session_data` and `dont_remember`, so the token was the one
      // being dropped: the browser stored a partial cookie set and the session appeared
      // to reset at random. Collected first, then set once as an array (Node emits one
      // header per element).
      // `getSetCookie` needs undici (Node 18.14+). Guarded rather than called outright:
      // if it is ever missing, throwing here would 502 every single auth request — but
      // the fallback has to SPLIT what `.get` returns, because per spec it comma-joins
      // repeated headers into one malformed value. Relaying that verbatim would put the
      // cookies back into a single broken header, which is the bug this whole block fixes.
      const setCookies = typeof response.headers.getSetCookie === 'function'
         ? response.headers.getSetCookie()
         : splitSetCookie(response.headers.get('set-cookie'));
      response.headers.forEach((value, key) => {
         const name = key.toLowerCase();
         if (name === 'set-cookie' || STRIP_FROM_UPSTREAM.has(name)) return;
         res.setHeader(key, value);
      });
      if (setCookies.length > 0) {
         res.setHeader('Set-Cookie', setCookies);
      }

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
