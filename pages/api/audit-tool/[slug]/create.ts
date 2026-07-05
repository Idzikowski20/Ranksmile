import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../../database/database';
import verifyUser from '../../../../utils/verifyUser';
import { getCurrentUserId } from '../../../../utils/getUser';
import { verifyDomainOwnershipBySlug } from '../../../../utils/verifyDomainOwnership';
import { ensureAuditTables } from '../../../../lib/ensureAuditTables';
import { enqueueAudit } from '../../../../lib/auditRunner';
import { langForCountry } from '../../../../lib/countryLang';
import { getErrorMessage } from '../../../../lib/errors';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   await db.sync();
   await ensureAuditTables();
   const authorized = await verifyUser(req, res);
   if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
   if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }); }
   const userId = await getCurrentUserId(req, res);
   const ownership = await verifyDomainOwnershipBySlug(req.query.slug as string, userId);
   if (ownership === false) return res.status(403).json({ error: 'Access denied.' });
   if (ownership === null) return res.status(404).json({ error: 'Domain not found' });
   const domainId = (ownership as unknown as { ID: number }).ID;

   const body = (req.body || {}) as { url?: unknown, keywords?: unknown, country?: unknown };
   const url = typeof body.url === 'string' ? body.url.trim() : '';
   if (!url) return res.status(400).json({ error: 'A URL is required' });
   // Country → SERP language for competitor enrichment (defaults to English).
   const language = langForCountry(typeof body.country === 'string' ? body.country : '');

   const rawKeywords = Array.isArray(body.keywords) ? body.keywords : [];
   const seen = new Set<string>();
   const keywords: string[] = [];
   for (const k of rawKeywords) {
      if (typeof k !== 'string') continue;
      const kw = k.trim();
      if (!kw || seen.has(kw)) continue;
      seen.add(kw);
      keywords.push(kw);
      if (keywords.length >= 25) break;
   }
   if (keywords.length === 0) return res.status(400).json({ error: 'At least one keyword is required' });

   // Enqueue is idempotent (upsert on domain+url+keyword), so a partial batch + client
   // retry re-queues the same rows instead of duplicating them. Collect per-keyword
   // failures and only 500 when nothing was created.
   const ids: number[] = [];
   let failed = 0;
   for (const keyword of keywords) {
      try {
         ids.push(await enqueueAudit(domainId, url, keyword, language));
      } catch (e) {
         failed += 1;
         console.warn('[audit] enqueue failed:', getErrorMessage(e));
      }
   }
   if (ids.length === 0) return res.status(500).json({ error: 'Failed to create audits' });
   return res.status(202).json({ ids, failed });
}
