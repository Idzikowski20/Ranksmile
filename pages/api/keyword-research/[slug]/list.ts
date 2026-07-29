import type { NextApiRequest, NextApiResponse } from 'next';
import verifyUser from '../../../../utils/verifyUser';
import { getCurrentUserId } from '../../../../utils/getUser';
import { verifyDomainOwnershipBySlug } from '../../../../utils/verifyDomainOwnership';
import { ensureKeywordResearchTables } from '../../../../lib/ensureKeywordResearchTables';
import { queryRows } from '../../../../lib/db/query';
import type { TopicResearchCardDTO, TopicResearchStats, TopicResearchStatus } from '../../../../lib/topicResearchTypes';
import { withOrgPaymentAccess } from '../../../../lib/requireOrgPaymentAccess';

type ListRow = {
   id: number;
   seed: string;
   country: string;
   status: string;
   stats_json: string | Record<string, unknown> | null;
   created_at: string | null;
   finished_at: string | null;
};

function parseStats(raw: ListRow['stats_json']): TopicResearchStats | null {
   if (raw == null) return null;
   try {
      const obj = typeof raw === 'string' ? JSON.parse(raw) as unknown : raw;
      if (!obj || typeof obj !== 'object') return null;
      return obj as TopicResearchStats;
   } catch {
      return null;
   }
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
   await ensureKeywordResearchTables();
   const authorized = await verifyUser(req, res);
   if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
   if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Method not allowed' }); }
   const userId = await getCurrentUserId(req, res);
   const ownership = await verifyDomainOwnershipBySlug(req.query.slug as string, userId);
   if (ownership === false) return res.status(403).json({ error: 'Access denied.' });
   if (ownership === null) return res.status(404).json({ error: 'Domain not found' });
   const domainId = (ownership as unknown as { ID: number }).ID;

   const rows = await queryRows<ListRow>(
      `SELECT id, seed, country, status, stats_json, created_at, finished_at
       FROM keyword_research_runs WHERE domain_id = ? ORDER BY id DESC LIMIT 200`,
      [domainId],
   );

   const items: TopicResearchCardDTO[] = rows.map((r) => {
      const stats = parseStats(r.stats_json);
      return {
         id: r.id,
         seed: r.seed,
         country: r.country,
         status: r.status as TopicResearchStatus,
         totalIdeas: stats?.totalIdeas ?? null,
         searchVolume: stats?.searchVolume ?? null,
         createdAt: r.created_at,
         finishedAt: r.finished_at,
      };
   });

   return res.status(200).json({ items });
}

export default withOrgPaymentAccess(handler);
