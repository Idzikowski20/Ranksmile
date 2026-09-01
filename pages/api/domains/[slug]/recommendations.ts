import type { NextApiRequest, NextApiResponse } from 'next';
import { QueryTypes } from 'sequelize';
import db from '../../../../database/database';
import verifyUser from '../../../../utils/verifyUser';
import { getCurrentUserId } from '../../../../utils/getUser';
import { verifyDomainOwnershipBySlug } from '../../../../utils/verifyDomainOwnership';
import { withOrgPaymentAccess } from '@/src/infrastructure/billing/requireOrgPaymentAccess';

async function handler(req: NextApiRequest, res: NextApiResponse) {
   const authorized = await verifyUser(req, res);
   if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
   if (req.method !== 'GET' && req.method !== 'DELETE' && req.method !== 'POST') { res.setHeader('Allow', 'GET, DELETE, POST'); return res.status(405).json({ error: 'Method not allowed' }); }
   const userId = await getCurrentUserId(req, res);
   const ownership = await verifyDomainOwnershipBySlug(req.query.slug as string, userId);
   if (ownership === false) return res.status(403).json({ error: 'Access denied.' });
   if (ownership === null) return res.status(404).json({ error: 'Domain not found' });
   const domainId = (ownership as { ID: number }).ID;

   // DELETE — dismiss a single optimize/create recommendation (UI sends rec_<id>).
   if (req.method === 'DELETE') {
      const recId = parseInt(String(req.query.id ?? ''), 10);
      if (!Number.isInteger(recId)) return res.status(400).json({ error: 'Invalid recommendation id' });
      await db.query('DELETE FROM domain_recommendations WHERE id = ? AND domain_id = ?', { replacements: [recId, domainId] });
      return res.status(200).json({ ok: true });
   }

   // POST — record the Surfer-style optimize lifecycle on a rec. The UI's Optimize action
   // already imports the page and opens its editor (its "Content Editor"); this just links
   // that article to the rec and flips its status, so Content Audit shows the page as being
   // worked on — Surfer's optimization_status + content_editor_id.
   if (req.method === 'POST') {
      const body = (req.body ?? {}) as { id?: unknown; articleId?: unknown; status?: unknown };
      const recId = parseInt(String(body.id ?? req.query.id ?? ''), 10);
      if (!Number.isInteger(recId)) return res.status(400).json({ error: 'Invalid recommendation id' });
      const articleId = Number.isInteger(Number(body.articleId)) ? Number(body.articleId) : null;
      const status = typeof body.status === 'string' && body.status ? body.status : 'in_progress';
      await db.query(
         'UPDATE domain_recommendations SET optimization_status = ?, article_id = COALESCE(?, article_id) WHERE id = ? AND domain_id = ?',
         { replacements: [status, articleId, recId, domainId] },
      );
      return res.status(200).json({ ok: true, optimizationStatus: status, articleId });
   }

   const recommendations = await db.query<{
      id: number; domain_id: number; topic_id: number | null;
      title: string; rationale: string | null; priority: string | null; type: string | null;
      url: string | null; score: number | null; search_volume: number | null;
      keyword_difficulty: number | null; keyword: string | null; topic_title: string | null;
      optimization_status: string | null; article_id: number | null;
      content_score: number | null; word_count: number | null; created_at: string;
   }>(
      // LEFT JOIN page_audits to carry the page's word_count and content score onto optimize
      // recs (matched by url); create recs have no url so the join yields NULL. content_score
      // mirrors Surfer's per-page content score. search_volume/keyword_difficulty/topic_title
      // carry Surfer-style write metrics. Order by score within each priority band so the
      // striking-distance / opportunity ranking surfaces best-first, not insertion order.
      `SELECT dr.id, dr.domain_id, dr.topic_id, dr.title, dr.rationale, dr.priority, dr.type,
              dr.url, dr.score, dr.search_volume, dr.keyword_difficulty, dr.keyword, dr.topic_title,
              dr.optimization_status, dr.article_id, pa.score AS content_score, pa.word_count, dr.created_at
       FROM domain_recommendations dr
       LEFT JOIN page_audits pa ON pa.domain_id = dr.domain_id AND pa.url = dr.url
       WHERE dr.domain_id = ?
       ORDER BY CASE dr.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
                COALESCE(dr.score, 0) DESC, dr.id`,
      { replacements: [domainId], type: QueryTypes.SELECT },
   );
   return res.status(200).json({ recommendations });
}

export default withOrgPaymentAccess(handler);
