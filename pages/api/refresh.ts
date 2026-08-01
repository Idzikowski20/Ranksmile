import type { NextApiRequest, NextApiResponse } from 'next';
import { Op } from 'sequelize';
import db from '../../database/database';
import Keyword from '../../database/models/keyword';
import Domain from '../../database/models/domain';
import refreshAndUpdateKeywords from '../../utils/refresh';
import { getAppSettings } from './settings';
import verifyUser from '../../utils/verifyUser';
import parseKeywords from '../../utils/parseKeywords';
import { scrapeKeywordFromGoogle } from '../../utils/scraper';
import { withOrgPaymentAccess } from '../../lib/requireOrgPaymentAccess';
import { assertCronSecret } from '../../lib/cronAuth';
import { getCurrentUserId } from '../../utils/getUser';
import { ensureUserTenancy, getAccessibleWorkspaceIds } from '../../lib/tenancy';
import { verifyDomainOwnership } from '../../utils/verifyDomainOwnership';

type KeywordsRefreshRes = {
   keywords?: KeywordType[]
   error?: string|null,
}

type KeywordSearchResultRes = {
   searchResult?: {
      results: { title: string, url: string, position: number }[],
      keyword: string,
      position: number,
      country: string,
   },
   error?: string|null,
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
   await db.sync();

   // Failed-queue / platform retry — install-wide via CRON_SECRET
   if (req.method === 'POST' && assertCronSecret(req)) {
      return refresTheKeywords(req, res, { mode: 'cron' });
   }

   const authorized = await verifyUser(req, res);
   if (authorized !== 'authorized') {
      return res.status(401).json({ error: authorized });
   }
   if (req.method === 'GET') {
      return getKeywordSearchResults(req, res);
   }
   if (req.method === 'POST') {
      return refresTheKeywords(req, res, { mode: 'session' });
   }
   return res.status(502).json({ error: 'Unrecognized Route.' });
}

const refresTheKeywords = async (
   req: NextApiRequest,
   res: NextApiResponse<KeywordsRefreshRes>,
   opts: { mode: 'cron' | 'session' },
) => {
   if (!req.query.id || typeof req.query.id !== 'string') {
      return res.status(400).json({ error: 'keyword ID is Required!' });
   }
   if (req.query.id === 'all' && !req.query.domain) {
      return res.status(400).json({ error: 'When Refreshing all Keywords of a domian, the Domain name Must be provided.' });
   }
   const keywordIDs = req.query.id !== 'all' && (req.query.id as string).split(',').map((item) => parseInt(item, 10));
   const { domain } = req.query || {};

   let userId: string | null = null;
   let orgId: number | null = null;

   try {
      if (opts.mode === 'session') {
         userId = await getCurrentUserId(req, res);
         if (!userId) return res.status(401).json({ error: 'Not authorized' });
         ({ orgId } = await ensureUserTenancy(userId));

         if (req.query.id === 'all' && typeof domain === 'string') {
            const owned = await verifyDomainOwnership(domain, userId);
            if (owned === false) return res.status(403).json({ error: 'Access denied.' });
            if (owned === null) return res.status(404).json({ error: 'Domain not found.' });
         } else if (keywordIDs && keywordIDs.length) {
            const wsIds = await getAccessibleWorkspaceIds(userId);
            const rows = await Keyword.findAll({
               where: { ID: { [Op.in]: keywordIDs } },
               attributes: ['ID', 'domain'],
            });
            if (rows.length !== keywordIDs.length) {
               return res.status(403).json({ error: 'Access denied.' });
            }
            const domains = [...new Set(rows.map((r) => r.get('domain') as string))];
            for (const d of domains) {
               const owned = await Domain.findOne({
                  where: { domain: d, workspace_id: { [Op.in]: wsIds } },
                  attributes: ['ID'],
               });
               if (!owned) return res.status(403).json({ error: 'Access denied.' });
            }
         }
      }

      const settings = await getAppSettings();
      if (!settings || (settings && settings.scraper_type === 'never')) {
         return res.status(400).json({ error: 'Scraper has not been set up yet.' });
      }
      const query = req.query.id === 'all' && domain ? { domain } : { ID: { [Op.in]: keywordIDs } };
      await Keyword.update({ updating: true }, { where: query });
      const keywordQueries: Keyword[] = await Keyword.findAll({ where: query });
      const allDomains: Domain[] = await Domain.findAll();
      const domainList: DomainType[] = allDomains.map((d) => d.get({ plain: true }));

      let keywords = [];

      if (keywordIDs && keywordIDs.length === 1) {
         const refreshed: KeywordType[] = await refreshAndUpdateKeywords(keywordQueries, settings, domainList);
         keywords = refreshed;
      } else {
         refreshAndUpdateKeywords(keywordQueries, settings, domainList);
         keywords = parseKeywords(keywordQueries.map((el) => el.get({ plain: true })));
      }

      console.info('[api] keywords.refresh', JSON.stringify({
         userId,
         orgId,
         resource: typeof domain === 'string' ? domain : `ids:${req.query.id}`,
         mode: opts.mode,
         count: keywordQueries.length,
      }));

      return res.status(200).json({ keywords });
   } catch (error) {
      console.log('ERROR refreshTheKeywords: ', error);
      return res.status(400).json({ error: 'Error refreshing keywords!' });
   }
};

const getKeywordSearchResults = async (req: NextApiRequest, res: NextApiResponse<KeywordSearchResultRes>) => {
   if (!req.query.keyword || !req.query.country || !req.query.device) {
      return res.status(400).json({ error: 'A Valid keyword, Country Code, and device is Required!' });
   }
   try {
      const settings = await getAppSettings();
      if (!settings || (settings && settings.scraper_type === 'never')) {
         return res.status(400).json({ error: 'Scraper has not been set up yet.' });
      }
      const dummyKeyword: KeywordType = {
         ID: 99999999999999,
         keyword: req.query.keyword as string,
         device: 'desktop',
         country: req.query.country as string,
         domain: '',
         lastUpdated: '',
         volume: 0,
         added: '',
         position: 111,
         sticky: false,
         history: {},
         lastResult: [],
         url: '',
         tags: [],
         updating: false,
         lastUpdateError: false,
      };
      const scrapeResult = await scrapeKeywordFromGoogle(dummyKeyword, settings);
      if (scrapeResult && !scrapeResult.error) {
         const searchResult = {
            results: scrapeResult.result.filter((r) => !r.skipped),
            keyword: scrapeResult.keyword,
            position: scrapeResult.position !== 111 ? scrapeResult.position : 0,
            country: req.query.country as string,
         };
         return res.status(200).json({ error: '', searchResult });
      }
      return res.status(400).json({ error: 'Error Scraping Search Results for the given keyword!' });
   } catch (error) {
      console.log('ERROR refreshTheKeywords: ', error);
      return res.status(400).json({ error: 'Error refreshing keywords!' });
   }
};

export default withOrgPaymentAccess(handler);
