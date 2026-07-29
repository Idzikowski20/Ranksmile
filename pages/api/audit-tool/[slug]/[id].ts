import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../../database/database';
import verifyUser from '../../../../utils/verifyUser';
import { getCurrentUserId } from '../../../../utils/getUser';
import { verifyDomainOwnershipBySlug } from '../../../../utils/verifyDomainOwnership';
import { ensureAuditTables } from '../../../../lib/ensureAuditTables';
import { queryOne, AuditRunRow } from '../../../../lib/db/query';
import type { AuditResult } from '../../../../lib/auditTypes';
import { withOrgPaymentAccess } from '../../../../lib/requireOrgPaymentAccess';

async function handler(req: NextApiRequest, res: NextApiResponse) {
   await db.sync();
   await ensureAuditTables();
   const authorized = await verifyUser(req, res);
   if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
   if (req.method !== 'GET' && req.method !== 'DELETE') { res.setHeader('Allow', 'GET, DELETE'); return res.status(405).json({ error: 'Method not allowed' }); }
   const userId = await getCurrentUserId(req, res);
   const ownership = await verifyDomainOwnershipBySlug(req.query.slug as string, userId);
   if (ownership === false) return res.status(403).json({ error: 'Access denied.' });
   if (ownership === null) return res.status(404).json({ error: 'Domain not found' });
   const domainId = (ownership as unknown as { ID: number }).ID;

   const id = Number(req.query.id);
   if (!Number.isFinite(id)) return res.status(404).json({ error: 'Audit not found' });

   if (req.method === 'DELETE') {
      await db.query('DELETE FROM audit_runs WHERE id = ? AND domain_id = ?', { replacements: [id, domainId] });
      return res.status(200).json({ ok: true });
   }

   const row = await queryOne<AuditRunRow>(
      'SELECT * FROM audit_runs WHERE id = ? AND domain_id = ? LIMIT 1',
      [id, domainId],
   );
   if (!row) return res.status(404).json({ error: 'Audit not found' });

   // Postgres JSONB comes back already parsed (an object); SQLite TEXT comes back as a
   // string. Guard both — JSON.parse on an object throws and blanks the whole detail page.
   let result: AuditResult | null = null;
   if (row.status === 'completed' && row.result_json != null) {
      try {
         const raw = row.result_json as unknown;
         result = (typeof raw === 'string' ? JSON.parse(raw) : raw) as AuditResult;
      } catch { result = null; }
   }

   return res.status(200).json({
      run: {
         id: row.id,
         url: row.url,
         keyword: row.keyword,
         status: row.status,
         contentScore: row.content_score,
         createdAt: row.created_at,
         finishedAt: row.finished_at,
         error: row.error,
      },
      result,
   });
}

export default withOrgPaymentAccess(handler);
