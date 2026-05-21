import type { NextApiRequest, NextApiResponse } from 'next';
import { getSession } from '@auth0/nextjs-auth0';

/**
 * Weryfikuje użytkownika przez sesję Auth0 lub klucz API.
 * Zwraca 'authorized' gdy dostęp jest dozwolony, w przeciwnym razie komunikat błędu.
 */
const verifyUser = async (req: NextApiRequest, res: NextApiResponse): Promise<string> => {
   const allowedApiRoutes = [
      'GET:/api/keyword',
      'GET:/api/keywords',
      'GET:/api/domains',
      'POST:/api/refresh',
      'POST:/api/cron',
      'POST:/api/notify',
      'POST:/api/searchconsole',
      'GET:/api/searchconsole',
      'GET:/api/insight',
   ];

   const verifiedAPI = req.headers.authorization
      ? req.headers.authorization.substring('Bearer '.length) === process.env.APIKEY
      : false;
   const accessingAllowedRoute = req.url && req.method
      ? allowedApiRoutes.includes(`${req.method}:${req.url.replace(/\?(.*)/, '')}`)
      : false;

   // API key access (zewnętrzne integracje)
   if (verifiedAPI && accessingAllowedRoute) return 'authorized';
   if (verifiedAPI && !accessingAllowedRoute) return 'This Route cannot be accessed with API.';
   if (req.headers.authorization && !verifiedAPI) return 'Invalid API Key Provided.';

   // Auth0 session check — getSession jest async w v3.5+
   try {
      const session = await getSession(req, res);
      if (session?.user) return 'authorized';
   } catch (_err) {
      // brak sesji lub błąd dekryptowania
   }

   return 'Not authorized';
};

export default verifyUser;
