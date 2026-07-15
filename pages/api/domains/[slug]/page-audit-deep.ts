// POST /api/domains/[slug]/page-audit-deep { url } → { deep, cached }
// Deep-on-demand: returns the cached hybrid deep-analysis for a page when it is
// still valid, else runs it, stores it, and returns it. Cache validity (no extra
// fetch): deep_content_hash === content_hash (content unchanged since the deep run)
// AND deep_generated_at within the 30-day TTL.
import type { NextApiRequest, NextApiResponse } from 'next';
import { QueryTypes } from 'sequelize';
import db from '../../../../database/database';
import verifyUser from '../../../../utils/verifyUser';
import { getCurrentUserId } from '../../../../utils/getUser';
import { verifyDomainOwnershipBySlug } from '../../../../utils/verifyDomainOwnership';
import { runDeepAnalysisForUrl, DeepResult } from '../../../../lib/deepAnalysis';
import { getDomainLocale } from '../../../../lib/domainLanguage';

const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   const authorized = await verifyUser(req, res);
   if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
   if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }); }
   const userId = await getCurrentUserId(req, res);
   const ownership = await verifyDomainOwnershipBySlug(req.query.slug as string, userId);
   if (ownership === false) return res.status(403).json({ error: 'Access denied.' });
   if (ownership === null) return res.status(404).json({ error: 'Domain not found' });
   const domainId = (ownership as { ID: number }).ID;

   const url = ((req.body?.url as string) || '').trim();
   if (!url) return res.status(400).json({ error: 'url is required' });

   const rows = await db.query<{
      deep_json: string | null; deep_generated_at: string | null;
      deep_content_hash: string | null; content_hash: string | null;
   }>(
      `SELECT deep_json, deep_generated_at, deep_content_hash, content_hash
       FROM page_audits WHERE domain_id = ? AND url = ? LIMIT 1`,
      { replacements: [domainId, url], type: QueryTypes.SELECT },
   );
   const row = rows[0];
   if (!row) return res.status(404).json({ error: 'Page audit not found' });

   // Cache valid iff the deep analysis was built against the current content AND is
   // within TTL. A re-scan refreshes content_hash; divergence ⇒ content changed ⇒ stale.
   const fresh = !!row.deep_json && !!row.deep_generated_at
      && !!row.deep_content_hash && row.deep_content_hash === row.content_hash
      && (Date.now() - new Date(row.deep_generated_at).getTime()) < TTL_MS;
   if (fresh) {
      try {
         return res.status(200).json({ deep: JSON.parse(row.deep_json as string) as DeepResult, cached: true });
      } catch { /* malformed cache — fall through and recompute */ }
   }

   let deep: DeepResult;
   try {
      const locale = await getDomainLocale(domainId);
      deep = await runDeepAnalysisForUrl(url, '', locale.languageCode);
   } catch (e) {
      return res.status(502).json({ error: (e instanceof Error ? e.message : String(e)) || 'Deep analysis failed' });
   }

   // Stamp deep_content_hash = the current triage content_hash so the cache
   // self-invalidates when the next scan detects changed content.
   await db.query(
      `UPDATE page_audits SET deep_json = ?, deep_content_hash = content_hash,
              deep_generated_at = CURRENT_TIMESTAMP, status = 'deep'
       WHERE domain_id = ? AND url = ?`,
      { replacements: [JSON.stringify(deep), domainId, url] },
   );
   return res.status(200).json({ deep, cached: false });
}
