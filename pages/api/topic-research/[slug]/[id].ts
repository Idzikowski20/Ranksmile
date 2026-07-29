import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../../database/database';
import verifyUser from '../../../../utils/verifyUser';
import { getCurrentUserId } from '../../../../utils/getUser';
import { verifyDomainOwnershipBySlug } from '../../../../utils/verifyDomainOwnership';
import { ensureTopicResearchTables } from '../../../../lib/ensureTopicResearchTables';
import { queryOne, TopicResearchRunRow } from '../../../../lib/db/query';
import type { TopicResearchResult } from '../../../../lib/topicResearchTypes';
import { withOrgPaymentAccess } from '../../../../lib/requireOrgPaymentAccess';

async function handler(req: NextApiRequest, res: NextApiResponse) {
   await ensureTopicResearchTables();
   const authorized = await verifyUser(req, res);
   if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
   if (req.method !== 'GET' && req.method !== 'DELETE') { res.setHeader('Allow', 'GET, DELETE'); return res.status(405).json({ error: 'Method not allowed' }); }
   const userId = await getCurrentUserId(req, res);
   const ownership = await verifyDomainOwnershipBySlug(req.query.slug as string, userId);
   if (ownership === false) return res.status(403).json({ error: 'Access denied.' });
   if (ownership === null) return res.status(404).json({ error: 'Domain not found' });
   const domainId = (ownership as unknown as { ID: number }).ID;

   const id = Number(req.query.id);
   if (!Number.isFinite(id)) return res.status(404).json({ error: 'Topic research not found' });

   if (req.method === 'DELETE') {
      await db.query('DELETE FROM topic_research_runs WHERE id = ? AND domain_id = ?', { replacements: [id, domainId] });
      return res.status(200).json({ ok: true });
   }

   const row = await queryOne<TopicResearchRunRow>(
      'SELECT * FROM topic_research_runs WHERE id = ? AND domain_id = ? LIMIT 1',
      [id, domainId],
   );
   if (!row) return res.status(404).json({ error: 'Topic research not found' });

   let result: TopicResearchResult | null = null;
   if (row.status === 'completed' && row.result_json != null) {
      try {
         const raw = row.result_json as unknown;
         result = (typeof raw === 'string' ? JSON.parse(raw) : raw) as TopicResearchResult;
      } catch { result = null; }
   }

   return res.status(200).json({
      run: {
         id: row.id,
         seed: row.seed,
         country: row.country,
         status: row.status,
         createdAt: row.created_at,
         finishedAt: row.finished_at,
         error: row.error,
      },
      result,
   });
}

export default withOrgPaymentAccess(handler);
