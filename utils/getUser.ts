import type { NextApiRequest, NextApiResponse } from 'next';

const NEON_AUTH_BASE_URL = process.env.NEON_AUTH_BASE_URL!;
const SESSION_COOKIE = '__Secure-neon-auth.session_token';

const sessionCache = new WeakMap<NextApiRequest, Promise<string | null>>();

export const getCurrentUserId = async (req: NextApiRequest, _res: NextApiResponse): Promise<string | null> => {
   const cached = sessionCache.get(req);
   if (cached) return cached;

   const promise = (async () => {
      const sessionToken = req.cookies?.[SESSION_COOKIE];
      if (!sessionToken || !NEON_AUTH_BASE_URL) return null;

      try {
         const response = await fetch(`${NEON_AUTH_BASE_URL}/get-session`, {
            method: 'GET',
            headers: {
               cookie: `${SESSION_COOKIE}=${sessionToken}`,
            },
         });
         if (!response.ok) return null;
         const data = await response.json() as { user?: { id?: string } };
         return data?.user?.id ?? null;
      } catch {
         return null;
      }
   })();

   sessionCache.set(req, promise);
   return promise;
};
