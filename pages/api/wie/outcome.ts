// GET/POST /api/wie/outcome — Performance Loop (metrics → pattern effectiveness)
import type { NextApiRequest, NextApiResponse } from 'next';
import verifyUser from '../../../utils/verifyUser';
import { withOrgPaymentAccess } from '../../../lib/requireOrgPaymentAccess';
import { getCurrentUserId } from '../../../utils/getUser';
import { assertArticleAccess } from '../../../lib/tenancy';
import {
  applyOutcomeLearning,
  listOutcomesForArticle,
  readWieLastRun,
  type OutcomeMetrics,
} from '../../../lib/wie/outcomeLearning';

function parseMetrics(raw: unknown): OutcomeMetrics | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const num = (k: string): number | undefined => {
    const v = o[k];
    return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
  };
  return {
    clicks: num('clicks'),
    impressions: num('impressions'),
    ctr: num('ctr'),
    position: num('position'),
    avgTimeSec: num('avgTimeSec'),
    bounceRate: num('bounceRate'),
    conversions: num('conversions'),
    windowDays: num('windowDays'),
  };
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const authorized = await verifyUser(req, res);
  if (authorized !== 'authorized') return res.status(401).json({ error: authorized });

  const userId = await getCurrentUserId(req, res);

  if (req.method === 'GET') {
    const articleId = parseInt(String(req.query.articleId), 10);
    if (!Number.isFinite(articleId)) return res.status(400).json({ error: 'articleId required' });
    if (!(await assertArticleAccess(userId, articleId))) {
      return res.status(403).json({ error: 'Access denied.' });
    }
    const [outcomes, lastRun] = await Promise.all([
      listOutcomesForArticle(articleId),
      readWieLastRun(articleId),
    ]);
    return res.status(200).json({ outcomes, lastRun });
  }

  if (req.method === 'POST') {
    const body = req.body && typeof req.body === 'object' ? req.body as Record<string, unknown> : {};
    const articleId = typeof body.articleId === 'number'
      ? body.articleId
      : parseInt(String(body.articleId), 10);
    if (!Number.isFinite(articleId)) return res.status(400).json({ error: 'articleId required' });
    if (!(await assertArticleAccess(userId, articleId))) {
      return res.status(403).json({ error: 'Access denied.' });
    }
    const metrics = parseMetrics(body.metrics);
    if (!metrics) return res.status(400).json({ error: 'metrics object required' });

    const patternIds = Array.isArray(body.patternIds)
      ? body.patternIds.filter((x): x is string => typeof x === 'string')
      : undefined;

    const result = await applyOutcomeLearning({ articleId, metrics, patternIds });
    return res.status(200).json(result);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

export default withOrgPaymentAccess(handler);
