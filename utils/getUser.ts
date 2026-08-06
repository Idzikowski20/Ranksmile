import type { NextApiRequest, NextApiResponse } from 'next';

const NEON_AUTH_BASE_URL = process.env.NEON_AUTH_BASE_URL!;
const SESSION_COOKIE = process.env.AUTH_SESSION_COOKIE_NAME || '__Secure-neon-auth.session_token';

export type SessionUser = { id: string; email: string | null };
const sessionCache = new WeakMap<NextApiRequest, Promise<SessionUser | null>>();

export const getCurrentUser = async (req: NextApiRequest, _res: NextApiResponse): Promise<SessionUser | null> => {
   const cached = sessionCache.get(req);
   if (cached) return cached;
   const promise = (async (): Promise<SessionUser | null> => {
      const sessionToken = req.cookies?.[SESSION_COOKIE];
      if (!sessionToken || !NEON_AUTH_BASE_URL) return null;
      try {
         const response = await fetch(`${NEON_AUTH_BASE_URL}/get-session`, {
            method: 'GET', headers: { cookie: `${SESSION_COOKIE}=${sessionToken}` },
         });
         if (!response.ok) return null;
         const data = await response.json() as { user?: { id?: string; email?: string } };
         if (!data?.user?.id) return null;
         return { id: data.user.id, email: data.user.email ?? null };
      } catch {
         return null;
      }
   })();
   sessionCache.set(req, promise);
   return promise;
};

export const getCurrentUserId = async (req: NextApiRequest, res: NextApiResponse): Promise<string | null> => {
   const u = await getCurrentUser(req, res);
   return u?.id ?? null;
};
