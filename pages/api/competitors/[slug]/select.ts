import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../../database/database';
import verifyUser from '../../../../utils/verifyUser';
import { getCurrentUserId } from '../../../../utils/getUser';
import { verifyDomainOwnershipBySlug } from '../../../../utils/verifyDomainOwnership';
import { ensureCompetitorsTables } from '../../../../lib/ensureCompetitorsTables';
import { setSelection } from '../../../../lib/competitorScan';
import { withOrgPaymentAccess } from '../../../../lib/requireOrgPaymentAccess';

async function handler(req: NextApiRequest, res: NextApiResponse) {
   await db.sync();
   await ensureCompetitorsTables();
   const authorized = await verifyUser(req, res);
   if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
   if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }); }
   const userId = await getCurrentUserId(req, res);
   const ownership = await verifyDomainOwnershipBySlug(req.query.slug as string, userId);
   if (ownership === false) return res.status(403).json({ error: 'Access denied.' });
   if (ownership === null) return res.status(404).json({ error: 'Domain not found' });
   const domainId = (ownership as unknown as { ID: number }).ID;

   const { keyword, selectedIds } = req.body as { keyword?: string; selectedIds?: unknown };
   if (!keyword) return res.status(400).json({ error: 'keyword is required' });
   if (!Array.isArray(selectedIds)) return res.status(400).json({ error: 'selectedIds must be an array' });

   const ids = selectedIds.map((n) => Number(n)).filter((n) => Number.isFinite(n));

   await setSelection(domainId, keyword, ids);
   return res.status(200).json({ ok: true });
}

export default withOrgPaymentAccess(handler);
