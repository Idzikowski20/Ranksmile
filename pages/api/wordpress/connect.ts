// POST /api/wordpress/connect — finishes the WP plugin handshake.
// Our /wordpress/connect page (opened by the plugin with ?token&url) posts here.
// We mint an api_key, hand it to the plugin's connect-verify route, and store the
// connection scoped to the user's workspace.
import type { NextApiRequest, NextApiResponse } from 'next';
import verifyUser from '../../../utils/verifyUser';
import { getCurrentUser } from '../../../utils/getUser';
import { getAccessibleWorkspaceIds } from '../../../lib/tenancy';
import { createConnection, mintApiKey } from '../../../lib/wpConnection';
import { wpRestFetch } from '../../../lib/wpRest';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   const authorized = await verifyUser(req, res);
   if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
   if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ error: 'Method not allowed' });
   }

   const user = await getCurrentUser(req, res);
   if (!user?.id) return res.status(401).json({ error: 'Not authenticated' });

   const { token, siteUrl, workspaceId, orgName } = req.body || {};
   if (!token || !siteUrl || !workspaceId) {
      return res.status(400).json({ error: 'token, siteUrl and workspaceId are required' });
   }

   const allowed = await getAccessibleWorkspaceIds(user.id);
   if (!allowed.includes(Number(workspaceId))) return res.status(403).json({ error: 'Access denied.' });

   const apiKey = mintApiKey();
   try {
      // wpRestFetch falls back to `?rest_route=` when the site's pretty /wp-json/
      // routing is broken (LiteSpeed/plain-permalink hosts), so the handshake works
      // regardless of the WordPress site's permalink configuration.
      const r = await wpRestFetch(String(siteUrl), 'surferseo/v1/connect/', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
            token,
            api_key: apiKey,
            organization_name: orgName || 'My organization',
            via_email: user.email || '',
         }),
      });
      if (!r.ok) {
         return res.status(502).json({ error: 'WordPress rejected the connection — check the plugin is installed and the token is still valid.' });
      }
      const data = await r.json().catch(() => ({}));
      if (!data?.token_saved) {
         return res.status(502).json({ error: 'WordPress did not confirm the connection.' });
      }
   } catch {
      return res.status(502).json({ error: 'Could not reach the WordPress site.' });
   }

   await createConnection({ workspaceId: Number(workspaceId), userId: user.id, siteUrl, apiKey, orgName: orgName || null, email: user.email || null });
   return res.status(200).json({ connected: true });
}
