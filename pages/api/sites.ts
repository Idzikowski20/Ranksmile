import type { NextApiRequest, NextApiResponse } from 'next';
import { auth, searchconsole_v1 } from '@googleapis/searchconsole';
import Cryptr from 'cryptr';
import verifyUser from '../../utils/verifyUser';
import { getCurrentUserId } from '../../utils/getUser';
import { getScopedWorkspaceIds, ForbiddenWorkspaceError } from '../../lib/tenancy';
import db from '../../database/database';
import Domain from '../../database/models/domain';
import GscAccount from '../../database/models/gscAccount';
import { buildOAuthClientFromAccount } from '../../lib/gscAccounts';
import { readLocalSCData, getSearchConsoleApiInfo, fetchDomainSCData, hasValidSCAuth } from '../../utils/searchConsole';
import { getErrorMessage } from '../../lib/errors';

type GSCSite = {
  siteUrl: string;
  permissionLevel: string;
};

type DomainStats = {
  impressions: number;
  clicks: number;
  position: number;
  chart: { date: string; clicks: number; impressions: number }[];
};

type SitesResponse = {
  sites?: GSCSite[];
  domainStats?: Record<string, DomainStats>;
  error?: string;
};

async function getOAuthClientFromDomain(domainRecord: { search_console?: string | null }) {
  const domainSC = domainRecord.search_console ? JSON.parse(domainRecord.search_console) : {};
  if (domainSC.auth_type !== 'oauth' || !domainSC.oauth_refresh_token) return null;

  const cryptr = new Cryptr(process.env.SECRET as string);
  const refreshToken = cryptr.decrypt(domainSC.oauth_refresh_token);
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const baseUrl = process.env.AUTH0_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  const oauth2 = new auth.OAuth2(clientId, clientSecret, `${baseUrl}/api/gsc/callback`);
  oauth2.setCredentials({ refresh_token: refreshToken });
  return oauth2;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<SitesResponse>) {
  await db.sync();
  const authorized = await verifyUser(req, res);
  if (authorized !== 'authorized') {
    return res.status(401).json({ error: authorized });
  }
  const userId = await getCurrentUserId(req, res);
  if (!userId) return res.status(401).json({ error: 'Not authorized' });

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let wsIds: number[];
  try {
    wsIds = await getScopedWorkspaceIds(req, userId);
  } catch (e) {
    if (e instanceof ForbiddenWorkspaceError) {
      return res.status(403).json({ error: 'Forbidden workspace' });
    }
    throw e;
  }

  const { Op } = await import('sequelize');

  const allSites: GSCSite[] = [];
  const errors: string[] = [];

  // Fetch configured domains for chart data
  const configuredDomains = wsIds.length
    ? await Domain.findAll({ where: { workspace_id: { [Op.in]: wsIds } } })
    : [];
  const domainStats: Record<string, DomainStats> = {};

  for (const d of configuredDomains) {
    const plain = d.get({ plain: true });
    const scData = await readLocalSCData(plain.domain);
    const statsArr = scData && scData.stats ? scData.stats : [];
    // Last 60 days so the dashboard can compare the last 30d vs the previous 30d.
    const recentStats = statsArr.slice(-60);
    domainStats[plain.domain] = {
      impressions: plain.scImpressions || 0,
      clicks: plain.scVisits || 0,
      position: plain.scPosition ? Math.round(plain.scPosition) : 0,
      chart: recentStats.map((s: SearchAnalyticsStat) => ({
        date: s.date,
        clicks: s.clicks || 0,
        impressions: s.impressions || 0,
      })),
    };

    // Stale-while-revalidate: if we haven't refreshed in >18h, kick a background GSC
    // fetch so the next dashboard load is current (GSC data itself lags ~2-3 days).
    const lastFetched = (scData && (scData as { lastFetched?: string }).lastFetched) || '';
    if (!lastFetched || Date.now() - new Date(lastFetched).getTime() > 18 * 60 * 60 * 1000) {
      getSearchConsoleApiInfo(plain, userId)
        .then((scApi) => (hasValidSCAuth(scApi) ? fetchDomainSCData(plain, scApi) : undefined))
        .catch(() => {});
    }
  }

  try {
    const userAccounts = userId
      ? (await GscAccount.findAll({ where: { userId } })).map((row) => row.get({ plain: true }))
      : [];
    for (const account of userAccounts) {
      try {
        const oauthClient = buildOAuthClientFromAccount(account);
        const client = new searchconsole_v1.Searchconsole({ auth: oauthClient });
        const response = await client.sites.list();
        if (response.data.siteEntry) {
          for (const s of response.data.siteEntry) {
            if (!s.siteUrl) continue;
            const entry = { siteUrl: s.siteUrl, permissionLevel: s.permissionLevel || 'siteOwner' };
            if (!allSites.find((existing) => existing.siteUrl === entry.siteUrl)) {
              allSites.push(entry);
            }
          }
        }
      } catch (err) {
        errors.push(`${account.email}: ${getErrorMessage(err)}`);
      }
    }

    // 2. Also try per-domain OAuth tokens for any domains that have them (legacy)
    if (userId) {
      const domains = await Domain.findAll({ where: { workspace_id: { [Op.in]: wsIds } } });
      for (const d of domains) {
        const plain = d.get({ plain: true });
        const scSettings = plain.search_console ? (() => { try { return JSON.parse(plain.search_console); } catch { return {}; } })() : {};
        if (scSettings.auth_type === 'oauth' && scSettings.oauth_refresh_token) {
          try {
            const oauthClient = await getOAuthClientFromDomain(plain);
            if (oauthClient) {
              const client = new searchconsole_v1.Searchconsole({ auth: oauthClient });
              const response = await client.sites.list();
              if (response.data.siteEntry) {
                for (const s of response.data.siteEntry) {
                  if (!s.siteUrl) continue;
                  const entry = { siteUrl: s.siteUrl, permissionLevel: s.permissionLevel || 'siteOwner' };
                  if (!allSites.find((existing) => existing.siteUrl === entry.siteUrl)) {
                    allSites.push(entry);
                  }
                }
              }
            }
          } catch (err) {
            errors.push(`${plain.domain}: ${getErrorMessage(err)}`);
          }
        }
      }
    }

    if (allSites.length === 0 && errors.length > 0) {
      console.log('[SITES API] All attempts failed:', errors.join(' | '));
      const expired = errors.some((e) => /invalid_grant/i.test(e));
      const error = expired
        ? 'Your Google Search Console connection has expired. Go to Settings and reconnect your Google account.'
        : 'Could not fetch sites from any GSC account. Check your Search Console integration.';
      return res.status(200).json({ sites: [], domainStats, error });
    }

    return res.status(200).json({ sites: allSites, domainStats });
  } catch (err) {
    console.log('[ERROR] Fetching GSC sites:', getErrorMessage(err));
    return res.status(500).json({ error: 'Failed to fetch sites from Search Console.' });
  }
}
