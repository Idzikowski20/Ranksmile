// GET /api/gsc/traffic-alerts?workspaceId=  → this week's drop tiers for the workspace's domain(s).
import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../database/database';
import verifyUser from '../../../utils/verifyUser';
import { getCurrentUserId } from '../../../utils/getUser';
import { getAccessibleWorkspaceIds } from '../../../lib/tenancy';
import { getSnapshot, weekStartFor, shiftWeek } from '../../../lib/gscSnapshots';
import { computeDrops } from '../../../lib/gscDrops';
import { withOrgPaymentAccess } from '../../../lib/requireOrgPaymentAccess';

async function handler(req: NextApiRequest, res: NextApiResponse) {
   const authorized = await verifyUser(req, res);
   if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
   const userId = await getCurrentUserId(req, res);
   if (!userId) return res.status(401).json({ error: 'Not authenticated' });

   const workspaceId = Number(req.query.workspaceId);
   if (!workspaceId) return res.status(400).json({ error: 'workspaceId is required' });
   const allowed = await getAccessibleWorkspaceIds(userId);
   if (!allowed.includes(workspaceId)) return res.status(403).json({ error: 'Access denied.' });

   const thisWeek = weekStartFor(new Date());
   const lastWeek = shiftWeek(thisWeek, -1);
   const [domRows] = await db.query('SELECT d."ID" AS id, d.domain FROM domain d WHERE d.workspace_id = ?', { replacements: [workspaceId] });

   const domains: Array<{ domain: string; tiers: ReturnType<typeof computeDrops>['tiers']; hasDrops: boolean }> = [];
   let haveBaseline = false;
   for (const d of domRows as Array<{ id: number; domain: string }>) {
      const prev = await getSnapshot(d.id, lastWeek);
      const now = await getSnapshot(d.id, thisWeek);
      if (prev.size > 0) haveBaseline = true;
      const r = computeDrops(now, prev);
      domains.push({ domain: d.domain, tiers: r.tiers, hasDrops: r.hasDrops });
   }
   // collecting = we don't yet have two weeks of data to compare anywhere.
   return res.status(200).json({ collecting: !haveBaseline, domains });
}

export default withOrgPaymentAccess(handler);
