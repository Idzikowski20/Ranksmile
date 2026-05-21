import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../database/database';
import { getCountryInsight, getKeywordsInsight, getPagesInsight } from '../../utils/insight';
import { fetchDomainSCData, getSearchConsoleApiInfo, readLocalSCData, hasValidSCAuth } from '../../utils/searchConsole';
import verifyUser from '../../utils/verifyUser';
import { getCurrentUserId } from '../../utils/getUser';
import { verifyDomainOwnership } from '../../utils/verifyDomainOwnership';
import Domain from '../../database/models/domain';

type SCInsightRes = {
   data: InsightDataType | null,
   error?: string|null,
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   await db.sync();
   const authorized = await verifyUser(req, res);
   if (authorized !== 'authorized') {
      return res.status(401).json({ error: authorized });
   }
   const userId = await getCurrentUserId(req, res);
   if (req.method === 'GET') {
      return getDomainSearchConsoleInsight(req, res, userId);
   }
   return res.status(502).json({ error: 'Unrecognized Route.' });
}

const getDomainSearchConsoleInsight = async (req: NextApiRequest, res: NextApiResponse<SCInsightRes>, userId?: string | null) => {
   if (!req.query.domain && typeof req.query.domain !== 'string') return res.status(400).json({ data: null, error: 'Domain is Missing.' });
   const domainname = (req.query.domain as string).replaceAll('-', '.').replaceAll('_', '-');
   const ownership = await verifyDomainOwnership(domainname, userId ?? null);
   if (ownership === false) return res.status(403).json({ data: null, error: 'Access denied.' });
   if (ownership === null) return res.status(404).json({ data: null, error: 'Domain not found.' });
   const getInsightFromSCData = (localSCData: SCDomainDataType): InsightDataType => {
      const { stats = [] } = localSCData;
      const countries = getCountryInsight(localSCData);
      const keywords = getKeywordsInsight(localSCData);
      const pages = getPagesInsight(localSCData);
      return { pages, keywords, countries, stats };
   };

   // First try and read the  Local SC Domain Data file.
   const localSCData = await readLocalSCData(domainname);

   if (localSCData) {
      const oldFetchedDate = localSCData.lastFetched;
      const fetchTimeDiff = new Date().getTime() - (oldFetchedDate ? new Date(oldFetchedDate as string).getTime() : 0);
      if (localSCData.stats && localSCData.stats.length && fetchTimeDiff <= 86400000) {
         const response = getInsightFromSCData(localSCData);
         return res.status(200).json({ data: response });
      }
   }

   // If the Local SC Domain Data file does not exist, fetch from Googel Search Console.
   try {
      const query = { domain: domainname };
      const foundDomain:Domain| null = await Domain.findOne({ where: query });
      const domainObj: DomainType = foundDomain && foundDomain.get({ plain: true });
      const scDomainAPI = await getSearchConsoleApiInfo(domainObj, userId);
      if (!hasValidSCAuth(scDomainAPI)) {
         return res.status(200).json({ data: null, error: 'Google Search Console is not Integrated.' });
      }
      const scData = await fetchDomainSCData(domainObj, scDomainAPI);
      const response = getInsightFromSCData(scData);
      return res.status(200).json({ data: response });
   } catch (error) {
      console.log('[ERROR] Getting Domain Insight: ', domainname, error);
      return res.status(400).json({ data: null, error: 'Error Fetching Stats from Google Search Console.' });
   }
};
