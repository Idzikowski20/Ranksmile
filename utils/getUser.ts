import type { NextApiRequest, NextApiResponse } from 'next';

const NEON_AUTH_BASE_URL = process.env.NEON_AUTH_BASE_URL!;
const SESSION_COOKIE = process.env.AUTH_SESSION_COOKIE_NAME || '__Secure-neon-auth.session_token';

export type SessionUser = { id: string; email: string | null };
const sessionCache = new WeakMap<NextApiRequest, Promise<SessionUser | null>>();

/**
 * Every path that fails to resolve a session used to `return null` in silence, so a
 * missing cookie, a rejected token, a 500 from the auth server and an unreachable auth
 * server were indistinguishable — all four reached the browser as a flat 401
 * "Not authorized" with nothing in the server log to tell them apart.
 *
 * The session token itself is never logged: only the reason and the route.
 */
function deny(req: NextApiRequest, reason: string): null {
   console.warn(`[auth] no session for ${req.method} ${req.url?.split('?')[0] ?? '?'}: ${reason}`);
   return null;
}

export const getCurrentUser = async (req: NextApiRequest, _res: NextApiResponse): Promise<SessionUser | null> => {
   const cached = sessionCache.get(req);
   if (cached) return cached;
   const promise = (async (): Promise<SessionUser | null> => {
      const sessionToken = req.cookies?.[SESSION_COOKIE];
      if (!sessionToken) return deny(req, 'no session cookie on the request');
      if (!NEON_AUTH_BASE_URL) return deny(req, 'NEON_AUTH_BASE_URL is not configured');
      try {
         const response = await fetch(`${NEON_AUTH_BASE_URL}/get-session`, {
            method: 'GET', headers: { cookie: `${SESSION_COOKIE}=${sessionToken}` },
         });
         if (!response.ok) return deny(req, `auth server replied HTTP ${response.status}`);
         const data = await response.json() as { user?: { id?: string; email?: string } };
         if (!data?.user?.id) return deny(req, 'auth server returned no user for this token');
         return { id: data.user.id, email: data.user.email ?? null };
      } catch (err) {
         // A transport failure is not the same as "logged out", and until now both left
         // through the same silent `return null` and surfaced to the browser as a flat
         // 401 "Not authorized" with nothing on the server to explain it.
         return deny(req, `could not reach the auth server: ${err instanceof Error ? err.message : String(err)}`);
      }
   })();
   sessionCache.set(req, promise);
   return promise;
};

export const getCurrentUserId = async (req: NextApiRequest, res: NextApiResponse): Promise<string | null> => {
   const u = await getCurrentUser(req, res);
   return u?.id ?? null;
};
