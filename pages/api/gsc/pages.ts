import type { NextApiRequest, NextApiResponse } from 'next';
import { searchconsole_v1 } from '@googleapis/searchconsole';
import verifyUser from '../../../utils/verifyUser';
import { getCurrentUserId } from '../../../utils/getUser';
import db from '../../../database/database';
import GscAccount from '../../../database/models/gscAccount';
import { buildOAuthClientFromAccount } from '../../../lib/gscAccounts';
import { getErrorMessage } from '../../../lib/errors';

type GscPage = {
   url: string;
   clicks: number;
   impressions: number;
};

type PagesResponse = {
   pages?: GscPage[];
   error?: string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse<PagesResponse>) {
   await db.sync();

   const authorized = await verifyUser(req, res);
   if (authorized !== 'authorized') {
      return res.status(401).json({ error: authorized });
   }

   if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
   }

   const { siteUrl } = req.query;
   if (!siteUrl || typeof siteUrl !== 'string') {
      return res.status(400).json({ error: 'siteUrl is required' });
   }

   const userId = await getCurrentUserId(req, res);
   if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
   }

   const userAccounts = (await GscAccount.findAll({ where: { userId } })).map((row) => row.get({ plain: true }));
   if (userAccounts.length === 0) {
      return res.status(200).json({ pages: [] });
   }

   // End date: today, start date: 30 days ago
   const endDate = new Date();
   const startDate = new Date();
   startDate.setDate(startDate.getDate() - 30);
   const fmt = (d: Date) => d.toISOString().split('T')[0];

   for (const account of userAccounts) {
      try {
         const oauthClient = buildOAuthClientFromAccount(account);
         const client = new searchconsole_v1.Searchconsole({ auth: oauthClient });

         const response = await client.searchanalytics.query({
            siteUrl,
            requestBody: {
               startDate: fmt(startDate),
               endDate: fmt(endDate),
               dimensions: ['page'],
               rowLimit: 500,
               startRow: 0,
            },
         });

         const rows = response.data.rows || [];
         const pages: GscPage[] = rows.map((row: any) => ({
            url: row.keys?.[0] || '',
            clicks: row.clicks || 0,
            impressions: row.impressions || 0,
         })).filter((p) => !!p.url);

         // Sort by clicks desc
         pages.sort((a, b) => b.clicks - a.clicks);

         return res.status(200).json({ pages });
      } catch (err) {
         // Try next account
         console.log(`[GSC pages] Account ${account.email} failed: ${getErrorMessage(err)}`);
      }
   }

   // All accounts failed or no data
   return res.status(200).json({ pages: [] });
}
