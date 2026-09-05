// GET /api/ai-usage — the current organization's AI token usage for the 5h window (for the ring).
import type { NextApiRequest, NextApiResponse } from 'next';
import { ensureUserTenancy } from '@/src/infrastructure/identity/tenancy';
import { getOrgUsage5h, AI_TOKEN_LIMIT_5H, AI_WINDOW_MS, windowStart } from '@/src/infrastructure/ai/aiTokenUsage';
import { withOrgPaymentAccess } from '@/src/infrastructure/billing/requireOrgPaymentAccess';
import { getCurrentUserId } from '../../utils/getUser';
import verifyUser from '../../utils/verifyUser';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const authorized = await verifyUser(req, res);
  if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
  try {
    const userId = await getCurrentUserId(req, res);
    const { orgId } = await ensureUserTenancy(String(userId));
    return res.status(200).json(await getOrgUsage5h(orgId));
  } catch {
    // Never block the editor on a usage read — report an empty window.
    return res.status(200).json({ used: 0, limit: AI_TOKEN_LIMIT_5H, resetsAt: windowStart() + AI_WINDOW_MS, over: false });
  }
}

export default withOrgPaymentAccess(handler);
