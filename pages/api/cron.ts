import type { NextApiRequest, NextApiResponse } from 'next';
import { Op } from 'sequelize';
import db from '../../database/database';
import Keyword from '../../database/models/keyword';
import Domain from '../../database/models/domain';
import { getAppSettings } from './settings';
import verifyUser from '../../utils/verifyUser';
import { getCurrentUserId } from '../../utils/getUser';
import { getCallerRole } from '../../lib/members';
import { ensureUserTenancy } from '../../lib/tenancy';
import refreshAndUpdateKeywords from '../../utils/refresh';
import { queryRows } from '../../lib/db/query';

type CRONRefreshRes = {
   started: boolean
   error?: string|null,
}

function isApiKeyAuth(req: NextApiRequest): boolean {
   const auth = req.headers.authorization;
   if (!auth?.startsWith('Bearer ') || !process.env.APIKEY) return false;
   return auth.substring('Bearer '.length) === process.env.APIKEY;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   await db.sync();
   const authorized = await verifyUser(req, res);
   if (authorized !== 'authorized') {
      return res.status(401).json({ error: authorized });
   }
   if (req.method === 'POST') {
      // APIKEY = install-wide scheduler. Session: owner/admin of *their* org only.
      const isApiKey = isApiKeyAuth(req);
      let orgId: number | null = null;
      if (!isApiKey) {
         const userId = await getCurrentUserId(req, res);
         if (!userId) return res.status(401).json({ started: false, error: 'Not authorized' });
         const role = await getCallerRole(String(userId)).catch(() => null);
         if (role !== 'owner' && role !== 'admin') {
            return res.status(403).json({ started: false, error: 'Admin only.' });
         }
         ({ orgId } = await ensureUserTenancy(userId));
      }
      return cronRefreshkeywords(req, res, orgId);
   }
   return res.status(502).json({ error: 'Unrecognized Route.' });
}

const cronRefreshkeywords = async (
   req: NextApiRequest,
   res: NextApiResponse<CRONRefreshRes>,
   orgId: number | null,
) => {
   try {
      const settings = await getAppSettings();
      if (!settings || (settings && settings.scraper_type === 'never')) {
         return res.status(400).json({ started: false, error: 'Scraper has not been set up yet.' });
      }

      let domainFilter: string[] | null = null;
      if (orgId != null) {
         const owned = await queryRows<{ domain: string }>(
            `SELECT d.domain FROM domain d
               JOIN workspaces w ON w.id = d.workspace_id
              WHERE w.org_id = ?`,
            [orgId],
         );
         domainFilter = owned.map((r) => r.domain).filter(Boolean);
         if (domainFilter.length === 0) {
            return res.status(200).json({ started: true });
         }
      }

      const keywordWhere = domainFilter ? { domain: { [Op.in]: domainFilter } } : {};
      await Keyword.update({ updating: true }, { where: keywordWhere });
      const keywordQueries: Keyword[] = await Keyword.findAll({ where: keywordWhere });
      const allDomains: Domain[] = await Domain.findAll({
         attributes: ['domain', 'scrape_strategy', 'scrape_pagination_limit', 'scrape_smart_full_fallback', 'subdomain_matching'],
         ...(domainFilter ? { where: { domain: { [Op.in]: domainFilter } } } : {}),
      });
      const domainList: DomainType[] = allDomains.map((d) => d.get({ plain: true }));

      refreshAndUpdateKeywords(keywordQueries, settings, domainList);

      return res.status(200).json({ started: true });
   } catch (error) {
      console.log('[ERROR] CRON Refreshing Keywords: ', error);
      return res.status(400).json({ started: false, error: 'CRON Error refreshing keywords!' });
   }
};
