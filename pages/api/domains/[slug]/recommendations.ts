import type { NextApiRequest, NextApiResponse } from 'next';
import { QueryTypes } from 'sequelize';
import db from '../../../../database/database';
import verifyUser from '../../../../utils/verifyUser';
import { getCurrentUserId } from '../../../../utils/getUser';
import { verifyDomainOwnershipBySlug } from '../../../../utils/verifyDomainOwnership';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   const authorized = await verifyUser(req, res);
   if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
   if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Method not allowed' }); }
   const userId = await getCurrentUserId(req, res);
   const ownership = await verifyDomainOwnershipBySlug(req.query.slug as string, userId);
   if (ownership === false) return res.status(403).json({ error: 'Access denied.' });
   if (ownership === null) return res.status(404).json({ error: 'Domain not found' });
   const domainId = (ownership as { ID: number }).ID;

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
