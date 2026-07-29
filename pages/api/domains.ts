import type { NextApiRequest, NextApiResponse } from 'next';
import Cryptr from 'cryptr';
import db from '../../database/database';
import Domain from '../../database/models/domain';
import Keyword from '../../database/models/keyword';
import getdomainStats from '../../utils/domains';
import verifyUser from '../../utils/verifyUser';
import { getCurrentUserId } from '../../utils/getUser';
import { getAccessibleWorkspaceIds, getActiveWorkspaceId, getScopedWorkspaceIds, ForbiddenWorkspaceError } from '../../lib/tenancy';
import { verifyDomainOwnership } from '../../utils/verifyDomainOwnership';
import { checkSerchConsoleIntegration, removeLocalSCData } from '../../utils/searchConsole';
import { removeFromRetryQueue } from '../../utils/scraper';
import { withOrgPaymentAccess } from '../../lib/requireOrgPaymentAccess';

type DomainsGetRes = {
   domains: DomainType[]
   error?: string|null,
}

type DomainsAddResponse = {
   domains: DomainType[]|null,
   error?: string|null,
}

type DomainsDeleteRes = {
   domainRemoved: number,
   keywordsRemoved: number,
   SCDataRemoved: boolean,
   error?: string|null,
}

type DomainsUpdateRes = {
   domain: Domain|null,
   error?: string|null,
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
   await db.sync();
   const authorized = await verifyUser(req, res);
   if (authorized !== 'authorized') {
      return res.status(401).json({ error: authorized });
   }
   const userId = await getCurrentUserId(req, res);
   if (req.method === 'GET') {
      return getDomains(req, res, userId);
   }
   if (req.method === 'POST') {
      return addDomain(req, res, userId);
   }
   if (req.method === 'DELETE') {
      return deleteDomain(req, res, userId);
   }
   if (req.method === 'PUT') {
      return updateDomain(req, res);
   }
   return res.status(502).json({ error: 'Unrecognized Route.' });
}

export const getDomains = async (req: NextApiRequest, res: NextApiResponse<DomainsGetRes>, userId?: string | null) => {
   const withStats = !!req?.query?.withstats;
   try {
      if (!userId) return res.status(401).json({ domains: [], error: 'Not authorized' });
      const { Op } = await import('sequelize');
      const wsIds = await getScopedWorkspaceIds(req, userId);
      const allDomains: Domain[] = wsIds.length
         ? await Domain.findAll({ where: { workspace_id: { [Op.in]: wsIds } } })
         : [];
      const formattedDomains: DomainType[] = allDomains.map((el) => {
         const domainItem:DomainType = el.get({ plain: true });
         const scData = domainItem?.search_console ? JSON.parse(domainItem.search_console) : {};
         const { client_email, private_key } = scData;
         const searchConsoleData = scData ? { ...scData, client_email: client_email ? 'true' : '', private_key: private_key ? 'true' : '' } : {};
         return { ...domainItem, search_console: JSON.stringify(searchConsoleData) };
      });
      const theDomains: DomainType[] = withStats ? await getdomainStats(formattedDomains) : formattedDomains;
      return res.status(200).json({ domains: theDomains });
   } catch (error) {
      if (error instanceof ForbiddenWorkspaceError) {
         return res.status(403).json({ domains: [], error: 'Forbidden workspace' });
      }
      return res.status(400).json({ domains: [], error: 'Error Getting Domains.' });
   }
};

export const addDomain = async (req: NextApiRequest, res: NextApiResponse<DomainsAddResponse>, userId?: string | null) => {
   const { domains } = req.body;
   if (domains && Array.isArray(domains) && domains.length > 0) {
      type DomainCreateRow = {
         domain: string;
         slug: string;
         lastUpdated: string;
         added: string;
         userId: string | null;
         workspace_id: number | null;
      };
      const domainsToAdd: DomainCreateRow[] = [];
      const workspaceId = userId ? await getActiveWorkspaceId(req, userId) : null;

      domains.forEach((domain: string) => {
         domainsToAdd.push({
            domain: domain.trim(),
            slug: domain.trim().replaceAll('-', '_').replaceAll('.', '-').replaceAll('/', '-'),
            lastUpdated: new Date().toJSON(),
            added: new Date().toJSON(),
            userId: userId || null,
            workspace_id: workspaceId,
         });
      });
      try {
         // Global uniqueness: several routes key off the domain NAME (verifyDomainOwnership, keyword
         // lookups), so a duplicate name in another workspace would be a tenant-isolation hazard.
         const names: string[] = domainsToAdd.map((d: { domain: string }) => d.domain);
         const dup = await Domain.findOne({ where: { domain: names }, attributes: ['domain'] });
         if (dup) return res.status(409).json({ domains: [], error: `Domain already exists: ${dup.domain}` });
         const newDomains:Domain[] = await Domain.bulkCreate(domainsToAdd);
         const formattedDomains = newDomains.map((el) => el.get({ plain: true }));
         return res.status(201).json({ domains: formattedDomains });
      } catch (error) {
         console.log('[ERROR] Adding New Domain ', error);
         return res.status(400).json({ domains: [], error: 'Error Adding Domain.' });
      }
   } else {
      return res.status(400).json({ domains: [], error: 'Necessary data missing.' });
   }
};

export const deleteDomain = async (req: NextApiRequest, res: NextApiResponse<DomainsDeleteRes>, userId?: string | null) => {
   if (!req.query.domain && typeof req.query.domain !== 'string') {
      return res.status(400).json({ domainRemoved: 0, keywordsRemoved: 0, SCDataRemoved: false, error: 'Domain is Required!' });
   }
   try {
      const { domain } = req.query || {};
      // Workspace-scoped ownership (NOT the legacy userId column — null-userId rows let any user
      // delete cross-tenant). Authorization lives in verifyDomainOwnership's WHERE clause.
      const owns = await verifyDomainOwnership(domain as string, userId ?? null);
      if (owns === null) return res.status(404).json({ domainRemoved: 0, keywordsRemoved: 0, SCDataRemoved: false, error: 'Domain not found.' });
      if (owns === false) return res.status(403).json({ domainRemoved: 0, keywordsRemoved: 0, SCDataRemoved: false, error: 'Access denied.' });
      await Promise.all((await Keyword.findAll({ where: { domain } })).map((keyword) => removeFromRetryQueue(keyword.ID)));
      // Delete the verified domain row by its ID (not by name) so a same-named row in another
      // workspace can never be caught by the destroy.
      const removedDomCount: number = await Domain.destroy({ where: { ID: owns.ID } });
      const removedKeywordCount: number = await Keyword.destroy({ where: { domain } });
      const SCDataRemoved = await removeLocalSCData(domain as string);

      return res.status(200).json({ domainRemoved: removedDomCount, keywordsRemoved: removedKeywordCount, SCDataRemoved });
   } catch (error) {
      console.log('[ERROR] Deleting Domain: ', req.query.domain, error);
      return res.status(400).json({ domainRemoved: 0, keywordsRemoved: 0, SCDataRemoved: false, error: 'Error Deleting Domain' });
   }
};

export const updateDomain = async (req: NextApiRequest, res: NextApiResponse<DomainsUpdateRes>) => {
   if (!req.query.domain) {
      return res.status(400).json({ domain: null, error: 'Domain is Required!' });
   }
   const { domain } = req.query || {};
   const userId = await getCurrentUserId(req, res);
   const wsIds = await getAccessibleWorkspaceIds(userId);
   const existing = await Domain.findOne({ where: { domain } });
   if (existing) {
      const ws = (existing as unknown as { workspace_id: number | null }).workspace_id;
      if (ws == null || !wsIds.includes(Number(ws))) {
         return res.status(403).json({ domain: null, error: 'Access denied.' });
      }
   }
   const {
      notification_interval, notification_emails, search_console,
      scrape_strategy, scrape_pagination_limit, scrape_smart_full_fallback,
      subdomain_matching, brand_voice,
   } = req.body as DomainSettings;

   try {
      const domainToUpdate: Domain|null = await Domain.findOne({ where: { domain } });
      // Validate Search Console API Data
      if (domainToUpdate && search_console?.client_email && search_console?.private_key) {
         const theDomainObj = domainToUpdate.get({ plain: true });
         const isSearchConsoleAPIValid = await checkSerchConsoleIntegration({ ...theDomainObj, search_console: JSON.stringify(search_console) });
         if (!isSearchConsoleAPIValid.isValid) {
            return res.status(400).json({ domain: null, error: isSearchConsoleAPIValid.error });
         }
         const cryptr = new Cryptr(process.env.SECRET as string);
         search_console.client_email = search_console.client_email ? cryptr.encrypt(search_console.client_email.trim()) : '';
         search_console.private_key = search_console.private_key ? cryptr.encrypt(search_console.private_key.trim()) : '';
      }
      if (domainToUpdate) {
         domainToUpdate.set({
            notification_interval,
            notification_emails,
            search_console: JSON.stringify(search_console),
            scrape_strategy: scrape_strategy || '',
            scrape_pagination_limit: scrape_pagination_limit || 0,
            scrape_smart_full_fallback: !!scrape_smart_full_fallback,
            subdomain_matching: subdomain_matching || '',
            brand_voice: brand_voice ?? '',
         });
         await domainToUpdate.save();
      }
      return res.status(200).json({ domain: domainToUpdate });
   } catch (error) {
      console.log('[ERROR] Updating Domain: ', req.query.domain, error);
      return res.status(400).json({ domain: null, error: 'Error Updating Domain. An Unknown Error Occurred.' });
   }
};

export default withOrgPaymentAccess(handler);
