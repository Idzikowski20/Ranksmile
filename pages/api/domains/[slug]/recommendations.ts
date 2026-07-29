import type { NextApiRequest, NextApiResponse } from 'next';
import { QueryTypes } from 'sequelize';
import db from '../../../../database/database';
import verifyUser from '../../../../utils/verifyUser';
import { getCurrentUserId } from '../../../../utils/getUser';
import { verifyDomainOwnershipBySlug } from '../../../../utils/verifyDomainOwnership';
import { withOrgPaymentAccess } from '../../../../lib/requireOrgPaymentAccess';

async function handler(req: NextApiRequest, res: NextApiResponse) {
   const authorized = await verifyUser(req, res);
   if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
   if (req.method !== 'GET' && req.method !== 'DELETE') { res.setHeader('Allow', 'GET, DELETE'); return res.status(405).json({ error: 'Method not allowed' }); }
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

   const recommendations = await db.query<{
      id: number; domain_id: number; topic_id: number | null;
      title: string; rationale: string | null; priority: string | null; type: string | null;
      url: string | null; score: number | null; word_count: number | null; created_at: string;
   }>(
      // LEFT JOIN page_audits to carry word_count onto optimize recs (matched by url);
      // create recs have no url so the join yields NULL, which the UI tolerates.
      `SELECT dr.id, dr.domain_id, dr.topic_id, dr.title, dr.rationale, dr.priority, dr.type,
              dr.url, dr.score, pa.word_count, dr.created_at
       FROM domain_recommendations dr
       LEFT JOIN page_audits pa ON pa.domain_id = dr.domain_id AND pa.url = dr.url
       WHERE dr.domain_id = ?
       ORDER BY CASE dr.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, dr.id`,
      { replacements: [domainId], type: QueryTypes.SELECT },
   );
   return res.status(200).json({ recommendations });
}

export default withOrgPaymentAccess(handler);
