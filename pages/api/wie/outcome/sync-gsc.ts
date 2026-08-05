// POST /api/wie/outcome/sync-gsc — GSC 30d page metrics → Outcome Learning
import type { NextApiRequest, NextApiResponse } from 'next';
import verifyUser from '../../../../utils/verifyUser';
import { withOrgPaymentAccess } from '../../../../lib/requireOrgPaymentAccess';
import { getCurrentUserId } from '../../../../utils/getUser';
import { assertArticleAccess } from '../../../../lib/tenancy';
import { syncArticleOutcomeFromGsc } from '../../../../lib/wie/gscOutcomeSync';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const authorized = await verifyUser(req, res);
  if (authorized !== 'authorized') return res.status(401).json({ error: authorized });

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const userId = await getCurrentUserId(req, res);
  const body = req.body && typeof req.body === 'object' ? req.body as Record<string, unknown> : {};
  const articleId = typeof body.articleId === 'number'
    ? body.articleId
    : parseInt(String(body.articleId), 10);

  if (!Number.isFinite(articleId)) {
    return res.status(400).json({ error: 'articleId required' });
  }
  if (!(await assertArticleAccess(userId, articleId))) {
    return res.status(403).json({ error: 'Access denied.' });
  }

  const result = await syncArticleOutcomeFromGsc(articleId);
  return res.status(result.ok ? 200 : 422).json(result);
}

export default withOrgPaymentAccess(handler);
