import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../../database/database';
import verifyUser from '../../../../utils/verifyUser';
import { getCurrentUserId } from '../../../../utils/getUser';
import { verifyDomainOwnershipBySlug } from '../../../../utils/verifyDomainOwnership';
import { ensureAuditTables } from '../../../../lib/ensureAuditTables';
import { queryRows } from '../../../../lib/db/query';
import type { AuditCardDTO, AuditStatus } from '../../../../lib/auditTypes';

type ListRow = {
   id: number, url: string, keyword: string, status: string,
   content_score: number | null, progress_done: number | null, progress_total: number | null,
   created_at: string | null, finished_at: string | null, language: string | null,
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   await db.sync();
   await ensureAuditTables();
   const authorized = await verifyUser(req, res);
   if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
   if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Method not allowed' }); }
   const userId = await getCurrentUserId(req, res);
   const ownership = await verifyDomainOwnershipBySlug(req.query.slug as string, userId);
   if (ownership === false) return res.status(403).json({ error: 'Access denied.' });
   if (ownership === null) return res.status(404).json({ error: 'Domain not found' });
   const domainId = (ownership as unknown as { ID: number }).ID;

   const rows = await queryRows<ListRow>(
      `SELECT id, url, keyword, status, content_score, progress_done, progress_total, created_at, finished_at, language
       FROM audit_runs WHERE domain_id = ? ORDER BY id DESC LIMIT 200`,
      [domainId],
   );

   const items: AuditCardDTO[] = rows.map((r) => ({
      id: r.id,
      url: r.url,
      keyword: r.keyword,
      status: r.status as AuditStatus,
      contentScore: r.content_score,
      progressDone: r.progress_done || 0,
      progressTotal: r.progress_total || 0,
      createdAt: r.created_at,
      finishedAt: r.finished_at,
      language: r.language ?? null,
   }));

   return res.status(200).json({ items });
}
