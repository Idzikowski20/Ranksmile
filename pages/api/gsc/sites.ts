import type { NextApiRequest, NextApiResponse } from 'next';
import { searchconsole_v1 } from '@googleapis/searchconsole';
import verifyUser from '../../../utils/verifyUser';
import { getCurrentUserId } from '../../../utils/getUser';
import db from '../../../database/database';
import GscAccount from '../../../database/models/gscAccount';
import { buildOAuthClientFromAccount } from '../../../lib/gscAccounts';
import { getErrorMessage } from '../../../lib/errors';

type GscSite = {
   siteUrl: string;
   permissionLevel: string;
};

type SitesResponse = {
   sites?: GscSite[];
   error?: string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse<SitesResponse>) {
   await db.sync();

   const authorized = await verifyUser(req, res);
   if (authorized !== 'authorized') {
      return res.status(401).json({ error: authorized });
   }

   if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
   }

   const userId = await getCurrentUserId(req, res);
   if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
   }

   const userAccounts = (await GscAccount.findAll({ where: { userId } })).map((row) => row.get({ plain: true }));
   if (userAccounts.length === 0) {
      return res.status(200).json({ sites: [] });
   }

   for (const account of userAccounts) {
      try {
         const oauthClient = buildOAuthClientFromAccount(account);
         const client = new searchconsole_v1.Searchconsole({ auth: oauthClient });

         const response = await client.sites.list({});
         const entries = response.data.siteEntry || [];

         const sites: GscSite[] = entries
            .filter((entry: any) => entry.permissionLevel !== 'siteUnverifiedUser')
            .map((entry: any) => ({
               siteUrl: entry.siteUrl || '',
               permissionLevel: entry.permissionLevel || '',
            }));

         return res.status(200).json({ sites });
      } catch (err) {
         // Try next account
         console.log(`[GSC sites] Account ${account.email} failed: ${getErrorMessage(err)}`);
      }
   }

   // All accounts failed or no data
   return res.status(200).json({ sites: [] });
}
