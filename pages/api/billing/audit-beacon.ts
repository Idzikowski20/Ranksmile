import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import {
  BillingSource,
  emitBillingEvent,
  ensureCorrelationId,
  type BillingDecision,
  type BillingEventKind,
} from '../../../lib/billingAudit';
import { ensureUserTenancy } from '../../../lib/tenancy';
import { getCurrentUserId } from '../../../utils/getUser';
import { withOrgPaymentAccess } from '../../../lib/requireOrgPaymentAccess';

const schema = z.object({
  kind: z.enum(['ONBOARDING_REDIRECT', 'BILLING_EVENT']),
  source: z.nativeEnum(BillingSource).optional(),
  reason: z.string().min(1).max(500),
  decision: z.enum(['ALLOW', 'DENY', 'SKIP', 'ROLLBACK']),
  correlationId: z.string().min(1).max(120).optional(),
  meta: z.record(z.unknown()).optional(),
});

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = await getCurrentUserId(req, res);
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' });
  }

  const { orgId } = await ensureUserTenancy(userId);
  const body = parsed.data;
  await emitBillingEvent({
    kind: body.kind as BillingEventKind,
    source: body.source ?? BillingSource.ONBOARDING,
    reason: body.reason,
    decision: body.decision as BillingDecision,
    correlationId: ensureCorrelationId(body.correlationId),
    orgId,
    actorUserId: userId,
    meta: body.meta,
  });

  return res.status(204).end();
}

export default withOrgPaymentAccess(handler);
