import type { NextApiRequest, NextApiResponse } from 'next';

const NEON_AUTH_BASE_URL = process.env.NEON_AUTH_BASE_URL!;
const SESSION_COOKIE = process.env.AUTH_SESSION_COOKIE_NAME || '__Secure-neon-auth.session_token';

export type SessionUser = { id: string; email: string | null };
const sessionCache = new WeakMap<NextApiRequest, Promise<SessionUser | null>>();

/**
 * Requests whose session could not be resolved because the auth SERVER was the problem —
 * unreachable, or answering 5xx — as opposed to the token being rejected. Callers
 * (verifyUser) use this to say "auth service unavailable, try again" instead of the lie
 * "Not authorized": in dev the mprocs auth pane needs ~7.5s from spawn to listen
 * (measured; more when embedded Postgres cold-boots first), and every request in that
 * window used to come back as a flat 401.
 */
const authUnavailable = new WeakSet<NextApiRequest>();

export function wasAuthUnavailable(req: NextApiRequest): boolean {
   return authUnavailable.has(req);
}

/**
 * Backoff for exactly the failures that are not an answer about the user: the auth
 * server unreachable, or replying 5xx. Three retries totalling ~4.25s. A single retry
 * cannot bridge the measured dev cold-start (auth listens ~7.5s after spawn, and the
 * gap the browser actually hits — Next up, auth still booting — is a few seconds), so
 * "initial + one" would just move the false 401 a quarter-second later; three spans the
 * gap while capping a prod auth blip at ~4s of added latency. A 4xx from the auth
 * server is a verdict about the token and is never retried.
 */
const RETRY_DELAYS_MS = [250, 1000, 3000];

/**
 * Per-attempt ceiling. A server that accepts the TCP connection but never answers
 * (half-open, hung) would otherwise pin the request forever, and the backoff above would
 * never even start. Aborting counts as a transport failure and retries like one.
 */
const ATTEMPT_TIMEOUT_MS = 3000;

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
      let lastFailure = 'auth server did not answer';
      for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
         if (attempt > 0) {
            // eslint-disable-next-line no-await-in-loop
            await new Promise((r) => { setTimeout(r, RETRY_DELAYS_MS[attempt - 1]); });
         }
         let response: Response;
         try {
            // eslint-disable-next-line no-await-in-loop
            response = await fetch(`${NEON_AUTH_BASE_URL}/get-session`, {
               method: 'GET',
               headers: { cookie: `${SESSION_COOKIE}=${sessionToken}` },
               signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
            });
         } catch (err) {
            // Only the transport can land here: connection refused, reset, DNS, or the
            // per-attempt timeout. All are "the server did not answer" and are retried.
            lastFailure = `could not reach the auth server: ${err instanceof Error ? err.message : String(err)}`;
            continue;
         }
         if (response.status >= 500) {
            // The discarded body would otherwise hold the connection open for as long
            // as the failing server keeps writing.
            // eslint-disable-next-line no-await-in-loop
            await response.body?.cancel().catch(() => undefined);
            lastFailure = `auth server replied HTTP ${response.status}`;
            continue;
         }
         if (!response.ok) {
            // eslint-disable-next-line no-await-in-loop
            await response.body?.cancel().catch(() => undefined);
            return deny(req, `auth server replied HTTP ${response.status}`);
         }
         // A 2xx that is not valid JSON is a broken auth response, not a down server:
         // deny it outright rather than spending the whole backoff on it and then
         // reporting the service as unavailable.
         let data: { user?: { id?: string; email?: string } };
         try {
            // eslint-disable-next-line no-await-in-loop
            data = await response.json() as { user?: { id?: string; email?: string } };
         } catch (err) {
            return deny(req, `auth server returned an unreadable response: ${err instanceof Error ? err.message : String(err)}`);
         }
         if (!data?.user?.id) return deny(req, 'auth server returned no user for this token');
         return { id: data.user.id, email: data.user.email ?? null };
      }
      // Every attempt hit the server being down, not the token being wrong.
      authUnavailable.add(req);
      return deny(req, lastFailure);
   })();
   sessionCache.set(req, promise);
   return promise;
};

export const getCurrentUserId = async (req: NextApiRequest, res: NextApiResponse): Promise<string | null> => {
   const u = await getCurrentUser(req, res);
   return u?.id ?? null;
};
