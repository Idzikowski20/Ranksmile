// GET /api/audit?domain=<slug>&scFilter=thirtyDays
// Combines articles from DB with Search Console page-level data for content audit.
import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../database/database';
import { getPagesInsight } from '../../utils/insight';
import { readLocalSCData, fetchDomainSCData, getSearchConsoleApiInfo, hasValidSCAuth } from '../../utils/searchConsole';
import verifyUser from '../../utils/verifyUser';
import Domain from '../../database/models/domain';

export interface AuditItem {
  id: number;
  title: string;
  url: string;
  mainKeyword: string;
  contentScore: number;
  position: number | null;
  traffic: number | null;
  impressions: number | null;
  ctr: number | null;
  updatedAt: string;
}

export interface AuditResponse {
  items: AuditItem[];
  lastAnalysisAt: string | null;
  lastSCUpdate: string | null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await db.sync();
  const authorized = await verifyUser(req, res);
  if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const domainSlug = (req.query.domain as string || '').replaceAll('-', '.').replaceAll('_', '-');
  const scFilter = (req.query.scFilter as string) || 'thirtyDays';

  if (!domainSlug) return res.status(400).json({ error: 'domain is required' });

  try {
    // Look up domain
    const foundDomain = await Domain.findOne({ where: { slug: domainSlug.replaceAll('.', '-') } });
    if (!foundDomain) return res.status(404).json({ error: 'Domain not found' });
    const domainObj: DomainType = foundDomain.get({ plain: true });

    // Fetch articles
    const [articles] = await db.query(
      `SELECT id, title, target_keyword, meta_url, content_score, updated_at
       FROM articles
       WHERE domain_id = ? AND status IN ('published', 'draft', 'accepted')
       ORDER BY updated_at DESC
       LIMIT 100`,
      { replacements: [domainObj.ID] },
    );

    // Fetch SC data
    let scPages: SCInsightItem[] = [];
    let lastAnalysisAt: string | null = null;
    let lastSCUpdate: string | null = null;

    try {
      const localSCData = await readLocalSCData(domainObj.domain);
      if (localSCData) {
        lastSCUpdate = localSCData.lastFetched || null;
        if (localSCData.stats?.length) {
          lastAnalysisAt = localSCData.stats[localSCData.stats.length - 1]?.date || null;
        }
        scPages = getPagesInsight(localSCData, 'clicks', scFilter);
      } else {
        const scDomainAPI = await getSearchConsoleApiInfo(domainObj);
        if (hasValidSCAuth(scDomainAPI)) {
          const scData = await fetchDomainSCData(domainObj, scDomainAPI);
          lastSCUpdate = scData.lastFetched || null;
          if (scData.stats?.length) {
            lastAnalysisAt = scData.stats[scData.stats.length - 1]?.date || null;
          }
          scPages = getPagesInsight(scData, 'clicks', scFilter);
        }
      }
    } catch (e) {
      console.warn('[audit] SC data unavailable:', (e as Error)?.message);
    }

    // Build SC lookup by URL path
    const scByUrl = new Map<string, SCInsightItem>();
    for (const p of scPages) {
      if (p.page) {
        const path = new URL(p.page.startsWith('http') ? p.page : `https://x.com${p.page.startsWith('/') ? '' : '/'}${p.page}`).pathname;
        scByUrl.set(path, p);
      }
    }

    // Match articles with SC data
    const items: AuditItem[] = (articles as any[]).map((a: any) => {
      const articlePath = a.meta_url ? `/${(a.meta_url as string).replace(/^\//, '')}` : '';
      const sc = scByUrl.get(articlePath);

      return {
        id: a.id,
        title: a.title,
        url: articlePath,
        mainKeyword: a.target_keyword || '',
        contentScore: a.content_score ?? 0,
        position: sc ? Math.round(sc.position * 10) / 10 : null,
        traffic: sc ? sc.clicks : null,
        impressions: sc ? sc.impressions : null,
        ctr: sc ? Math.round(sc.ctr * 100) / 100 : null,
        updatedAt: a.updated_at,
      };
    });

    return res.status(200).json({ items, lastAnalysisAt, lastSCUpdate });
  } catch (error: any) {
    console.error('[audit] error:', error?.message);
    return res.status(500).json({ error: error?.message || 'Audit failed' });
  }
}
