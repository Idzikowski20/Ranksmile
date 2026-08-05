import type { NextApiRequest, NextApiResponse } from 'next';
import { getCurrentUserId } from '../../../utils/getUser';
import { createSetupWorkspace } from '../../../lib/workspaces';
import { BillingSource, emitBillingEvent, ensureCorrelationId } from '../../../lib/billingAudit';
import { withOrgPaymentAccess } from '../../../lib/requireOrgPaymentAccess';

async function handler(req: NextApiRequest, res: NextApiResponse) {
   const userId = await getCurrentUserId(req, res);
   if (!userId) return res.status(401).json({ error: 'Not authenticated' });
   if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }); }
   const id = await createSetupWorkspace(userId);
   const corrHeader = typeof req.headers['x-billing-correlation-id'] === 'string'
      ? req.headers['x-billing-correlation-id']
      : undefined;
   await emitBillingEvent({
      kind: 'ONBOARDING_REDIRECT',
      source: BillingSource.ONBOARDING,
      reason: 'workspaces.setup_created',
      decision: 'ALLOW',
      correlationId: ensureCorrelationId(corrHeader),
      actorUserId: userId,
      meta: {
         setupWorkspaceId: id,
         referer: typeof req.headers.referer === 'string' ? req.headers.referer : null,
      },
   });
   return res.status(201).json({ id });
}

export default withOrgPaymentAccess(handler);
