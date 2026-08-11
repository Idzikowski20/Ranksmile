import type { NextApiRequest, NextApiResponse } from 'next';

const NEON_AUTH_BASE_URL = process.env.NEON_AUTH_BASE_URL!;
const SESSION_COOKIE = process.env.AUTH_SESSION_COOKIE_NAME || '__Secure-neon-auth.session_token';

export type SessionUser = { id: string; email: string | null };
const sessionCache = new WeakMap<NextApiRequest, Promise<SessionUser | null>>();

/**
 * The route, with every dynamic segment masked.
 *
 * Logging the raw path leaked credentials: `/api/invitations/<token>/accept` carries the
 * invitation token as a path segment, so a failed unauthenticated call wrote a working
 * invitation link into the server log. Stripping the query string is not enough.
 *
 * Masking every value Next matched as a route param redacts the secret without a guess
 * about which routes are sensitive. Ordinary ids are masked too — the value of this line
 * is which route failed, not which record.
 */
function safeRoute(req: NextApiRequest): string {
   const [path = '?', search = ''] = (req.url || '').split('?');
   // `req.query` merges the matched route params with the query string, and an
   // unauthenticated caller controls the latter: `?x=articles` would mask the literal
   // `/api/articles` and make the log name a route that was never called. Keys present in
   // the query string are therefore excluded — what remains came from the path.
   const fromQueryString = new Set(
      [...new URLSearchParams(search).keys()],
   );
   const dynamic = new Set<string>();
   for (const [key, value] of Object.entries(req.query || {})) {
      if (fromQueryString.has(key)) continue;
      for (const part of Array.isArray(value) ? value : [value]) {
         if (typeof part === 'string' && part) dynamic.add(part);
      }
   }
   if (dynamic.size === 0) return path;
   return path.split('/').map((segment) => (dynamic.has(segment) ? ':x' : segment)).join('/');
}

/**
 * Every path that fails to resolve a session used to `return null` in silence, so a
 * missing cookie, a rejected token, a 500 from the auth server and an unreachable auth
 * server were indistinguishable — all four reached the browser as a flat 401
 * "Not authorized" with nothing in the server log to tell them apart.
 *
 * No credential is logged: not the session token, and not the route's own segments.
 */
function deny(req: NextApiRequest, reason: string): null {
   console.warn(`[auth] no session for ${req.method} ${safeRoute(req)}: ${reason}`);
   return null;
}

export const getCurrentUser = async (req: NextApiRequest, _res: NextApiResponse): Promise<SessionUser | null> => {
   const cached = sessionCache.get(req);
   if (cached) return cached;
   const promise = (async (): Promise<SessionUser | null> => {
      const sessionToken = req.cookies?.[SESSION_COOKIE];
      if (!sessionToken) return deny(req, 'no session cookie on the request');
      if (!NEON_AUTH_BASE_URL) return deny(req, 'NEON_AUTH_BASE_URL is not configured');
      /**
       * One retry, and only for the two failures that are not an answer about the user:
       * the auth server being unreachable, and it replying 5xx. A 401/403 from it means
       * this token really is not a session and must not be retried.
       *
       * Without this a single blip logged the caller out. Deep analysis showed it
       * plainly: the request that starts the run 401s, the page reports "Analysis failed
       * — Not authorized" with every stage still pending, and Try again works because
       * the next call reaches a healthy auth server.
       */
      for (let attempt = 0; attempt < 2; attempt += 1) {
         try {
            // eslint-disable-next-line no-await-in-loop
            const response = await fetch(`${NEON_AUTH_BASE_URL}/get-session`, {
               method: 'GET', headers: { cookie: `${SESSION_COOKIE}=${sessionToken}` },
            });
            if (response.status >= 500 && attempt === 0) {
               // eslint-disable-next-line no-await-in-loop
               await new Promise((r) => { setTimeout(r, 250); });
               continue;
            }
            if (!response.ok) return deny(req, `auth server replied HTTP ${response.status}`);
            // eslint-disable-next-line no-await-in-loop
            const data = await response.json() as { user?: { id?: string; email?: string } };
            if (!data?.user?.id) return deny(req, 'auth server returned no user for this token');
            return { id: data.user.id, email: data.user.email ?? null };
         } catch (err) {
            if (attempt === 0) {
               // eslint-disable-next-line no-await-in-loop
               await new Promise((r) => { setTimeout(r, 250); });
               continue;
            }
            // A transport failure is not the same as "logged out", but after a retry
            // there is nothing left to distinguish it with — the log line carries why.
            return deny(req, `could not reach the auth server: ${err instanceof Error ? err.message : String(err)}`);
         }
      }
      return deny(req, 'auth server did not answer after a retry');
   })();
   sessionCache.set(req, promise);
   return promise;
};

export const getCurrentUserId = async (req: NextApiRequest, res: NextApiResponse): Promise<string | null> => {
   const u = await getCurrentUser(req, res);
   return u?.id ?? null;
};
