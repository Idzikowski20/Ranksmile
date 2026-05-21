import type { NextApiRequest, NextApiResponse } from 'next';
import { auth, searchconsole_v1 } from '@googleapis/searchconsole';
import Cryptr from 'cryptr';
import verifyUser from '../../utils/verifyUser';
import { getCurrentUserId } from '../../utils/getUser';
import db from '../../database/database';
import Domain from '../../database/models/domain';
import GscAccount from '../../database/models/gscAccount';
import { buildOAuthClientFromAccount } from '../../lib/gscAccounts';

type GSCSite = {
  siteUrl: string;
  permissionLevel: string;
};

type SitesResponse = {
  sites?: GSCSite[];
  error?: string;
};

async function getOAuthClientFromDomain(domainRecord: any) {
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

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const allSites: GSCSite[] = [];
  const errors: string[] = [];

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
      } catch (err: any) {
        errors.push(`${account.email}: ${err?.message || err}`);
      }
    }

    // 2. Also try per-domain OAuth tokens for any domains that have them (legacy)
    if (userId) {
      const domains = await Domain.findAll({ where: { userId } });
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
          } catch (err: any) {
            errors.push(`${plain.domain}: ${err?.message || err}`);
          }
        }
      }
    }

    if (allSites.length === 0 && errors.length > 0) {
      console.log('[SITES API] All attempts failed:', errors.join(' | '));
      return res.status(200).json({ sites: [], error: 'Could not fetch sites from any GSC account. Check your Search Console integration.' });
    }

    return res.status(200).json({ sites: allSites });
  } catch (err: any) {
    console.log('[ERROR] Fetching GSC sites:', err?.message || err);
    return res.status(500).json({ error: 'Failed to fetch sites from Search Console.' });
  }
}
