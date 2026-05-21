import type { NextApiRequest, NextApiResponse } from 'next';
import { getSession } from '@auth0/nextjs-auth0';

/**
 * Zwraca Auth0 userId (sub) z aktywnej sesji, lub null gdy niezalogowany.
 * getSession jest async w @auth0/nextjs-auth0 v3.5+
 */
export const getCurrentUserId = async (req: NextApiRequest, res: NextApiResponse): Promise<string | null> => {
   try {
      const session = await getSession(req, res);
      return session?.user?.sub ?? null;
   } catch {
      return null;
   }
};
