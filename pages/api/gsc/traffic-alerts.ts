// GET /api/gsc/traffic-alerts?workspaceId=  → this week's drop tiers for the workspace's domain(s).
import type { NextApiRequest, NextApiResponse } from 'next';
import { getAccessibleWorkspaceIds } from '@/src/infrastructure/identity/tenancy';
import { withOrgPaymentAccess } from '@/src/infrastructure/billing/requireOrgPaymentAccess';
import db from '../../../database/database';
import verifyUser from '../../../utils/verifyUser';
import { getCurrentUserId } from '../../../utils/getUser';
import { getWeeklyDrops } from '../../../src/composition/gsc';
import type { DropResult } from '../../../src/core/domain/gsc/drops';

async function handler(req: NextApiRequest, res: NextApiResponse) {
   const authorized = await verifyUser(req, res);
   if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
   const userId = await getCurrentUserId(req, res);
   if (!userId) return res.status(401).json({ error: 'Not authenticated' });

   const workspaceId = Number(req.query.workspaceId);
   if (!workspaceId) return res.status(400).json({ error: 'workspaceId is required' });
   const allowed = await getAccessibleWorkspaceIds(userId);
   if (!allowed.includes(workspaceId)) return res.status(403).json({ error: 'Access denied.' });

   const [domRows] = await db.query('SELECT d."ID" AS id, d.domain FROM domain d WHERE d.workspace_id = ?', { replacements: [workspaceId] });

   const domains: Array<{ domain: string; tiers: DropResult['tiers']; hasDrops: boolean }> = [];
   let haveBaseline = false;
   for (const d of domRows as Array<{ id: number; domain: string }>) {
      const r = await getWeeklyDrops(d.id);
      if (r.hadBaseline) haveBaseline = true;
      domains.push({ domain: d.domain, tiers: r.tiers, hasDrops: r.hasDrops });
   }
   // collecting = we don't yet have two weeks of data to compare anywhere.
   return res.status(200).json({ collecting: !haveBaseline, domains });
}

export default withOrgPaymentAccess(handler);
