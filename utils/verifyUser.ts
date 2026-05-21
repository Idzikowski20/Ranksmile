import type { NextApiRequest, NextApiResponse } from 'next';
import { getCurrentUserId } from './getUser';

/**
 * Weryfikuje użytkownika przez sesję Neon Auth lub klucz API.
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

   // Neon Auth session check
   const userId = await getCurrentUserId(req, res);
   if (userId) return 'authorized';

   // Fallback: local USER/PASSWORD auth (dla prostych instalacji bez Neon Auth)
   const basicAuth = req.headers.authorization
      ? Buffer.from(req.headers.authorization.split(' ')[1] || '', 'base64').toString()
      : null;
   if (basicAuth) {
      const [user, pass] = basicAuth.split(':');
      if (user === process.env.USER && pass === process.env.PASSWORD) return 'authorized';
   }

   return 'Not authorized';
};

export default verifyUser;
