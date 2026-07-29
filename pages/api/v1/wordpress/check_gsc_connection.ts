// POST /api/v1/wordpress/check_gsc_connection — has the user who linked this WordPress
// site connected a Google Search Console account? (Drives the plugin's "Connected"
// status + GSC traffic widgets / drop monitor.) This is account-level, matching how
// Ranksmile treats GSC: connected the moment the Google OAuth account is linked — not
// only once 30 days of data has been scraped.
import type { NextApiRequest, NextApiResponse } from 'next';
import { authPluginRequest } from '../../../../lib/wpConnection';
import { getAccountsForUser } from '../../../../lib/gscAccounts';
import { withOrgPaymentAccess } from '../../../../lib/requireOrgPaymentAccess';

async function handler(req: NextApiRequest, res: NextApiResponse) {
   const conn = await authPluginRequest(req);
   if (!conn) return res.status(401).json({ message: 'Invalid api-key.' });

   const accounts = await getAccountsForUser(conn.user_id);
   return res.status(200).json({ gsc_connected: accounts.length > 0 });
}

export default withOrgPaymentAccess(handler);
