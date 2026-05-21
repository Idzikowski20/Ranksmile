/**
 * Neon Auth proxy for Pages Router.
 * Forwards all /api/auth/* requests to the Neon Auth upstream server,
 * then relays the response (including Set-Cookie headers) back to the client.
 */
import type { NextApiRequest, NextApiResponse } from 'next';

const BASE_URL = process.env.NEON_AUTH_BASE_URL;

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
         if (key.toLowerCase() !== 'transfer-encoding') {
            res.setHeader(key, value);
         }
      });

      res.status(response.status);
      const buffer = await response.arrayBuffer();
      res.end(Buffer.from(buffer));
   } catch (err) {
      console.error('[neon-auth proxy] error:', err);
      res.status(502).json({ error: 'Auth upstream unavailable' });
   }
}
