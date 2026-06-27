// POST /api/v1/wordpress/check_gsc_connection — is Search Console wired up for this
// workspace's domain? (Drives the plugin's GSC traffic widgets / drop monitor.)
import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../../database/database';
import { authPluginRequest } from '../../../../lib/wpConnection';
import { readLocalSCData } from '../../../../utils/searchConsole';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   const conn = await authPluginRequest(req);
   if (!conn) return res.status(401).json({ message: 'Invalid api-key.' });

   const [drows] = await db.query('SELECT domain FROM domain WHERE workspace_id = ? LIMIT 1', { replacements: [conn.workspace_id] });
   const domain = (drows as Array<{ domain: string }>)[0]?.domain;
   const sc = domain ? await readLocalSCData(domain) : false;
   const connected = !!(sc && sc.thirtyDays && sc.thirtyDays.length);
   return res.status(200).json({ gsc_connected: connected });
}
