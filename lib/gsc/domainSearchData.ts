import type { NextApiRequest, NextApiResponse } from 'next';
import Domain from '../../database/models/domain';
import { fetchDomainSCData, getSearchConsoleApiInfo, readLocalSCData, hasValidSCAuth } from '../../utils/searchConsole';
import { verifyDomainOwnership } from '../../utils/verifyDomainOwnership';

export type SearchConsoleDataRes = {
  data: SCDomainDataType | null;
  error?: string | null;
};

export type SearchConsoleCronRes = {
  status: string;
  error?: string | null;
};

/** Canonical GSC domain analytics handler (shared by /api/gsc/search-data and legacy alias). */
export async function getDomainSearchConsoleData(
  req: NextApiRequest,
  res: NextApiResponse<SearchConsoleDataRes>,
  userId?: string | null,
) {
  if (!req.query.domain && typeof req.query.domain !== 'string') {
    return res.status(400).json({ data: null, error: 'Domain is Missing.' });
  }
  const domainname = (req.query.domain as string).replaceAll('-', '.').replaceAll('_', '-');
  const startDate = typeof req.query.startDate === 'string' ? req.query.startDate : undefined;
  const endDate = typeof req.query.endDate === 'string' ? req.query.endDate : undefined;
  const country = typeof req.query.country === 'string' ? req.query.country : undefined;
  const device = typeof req.query.device === 'string' ? req.query.device : undefined;
  const keywordOperator = typeof req.query.keywordOperator === 'string' ? req.query.keywordOperator : undefined;
  const keywordValue = typeof req.query.keywordValue === 'string' ? req.query.keywordValue : undefined;
  const hasRealtimeQuery = Boolean(startDate || endDate || country || device || keywordOperator || keywordValue);

  if ((startDate && !endDate) || (!startDate && endDate)) {
    return res.status(400).json({ data: null, error: 'Both startDate and endDate are required.' });
  }

  const ownership = await verifyDomainOwnership(domainname, userId ?? null);
  if (ownership === false) return res.status(403).json({ data: null, error: 'Access denied.' });
  if (ownership === null) return res.status(404).json({ data: null, error: 'Domain not found.' });
  const localSCData = hasRealtimeQuery ? null : await readLocalSCData(domainname);
  if (localSCData && localSCData.thirtyDays && localSCData.thirtyDays.length) {
    return res.status(200).json({ data: localSCData });
  }
  try {
    const foundDomain: Domain | null = await Domain.findOne({ where: { domain: domainname } });
    const domainObj: DomainType = foundDomain && foundDomain.get({ plain: true });
    const scDomainAPI = await getSearchConsoleApiInfo(domainObj, userId);
    if (!hasValidSCAuth(scDomainAPI)) {
      return res.status(200).json({ data: null, error: 'Google Search Console is not Integrated.' });
    }
    const scData = await fetchDomainSCData(
      domainObj,
      scDomainAPI,
      hasRealtimeQuery
        ? {
            startDate,
            endDate,
            country,
            device,
            keywordOperator: keywordOperator as
              | 'contains'
              | 'equals'
              | 'notContains'
              | 'includingRegex'
              | 'excludingRegex'
              | undefined,
            keywordValue,
          }
        : undefined,
    );
    return res.status(200).json({ data: scData });
  } catch (error) {
    console.log('[ERROR] Getting Search Console Data for: ', domainname, error);
    return res.status(400).json({ data: null, error: 'Error Fetching Data from Google Search Console.' });
  }
}

export async function cronRefreshSearchConsoleData(
  _req: NextApiRequest,
  res: NextApiResponse<SearchConsoleCronRes>,
) {
  try {
    const allDomainsRaw = await Domain.findAll();
    const domains: DomainType[] = allDomainsRaw.map((el) => el.get({ plain: true }));
    for (const domain of domains) {
      const scDomainAPI = await getSearchConsoleApiInfo(domain);
      if (hasValidSCAuth(scDomainAPI)) {
        await fetchDomainSCData(domain, scDomainAPI);
      }
    }
    return res.status(200).json({ status: 'completed' });
  } catch (error) {
    console.log('[ERROR] CRON Updating Search Console Data. ', error);
    return res.status(400).json({ status: 'failed', error: 'Error Fetching Data from Google Search Console.' });
  }
}
