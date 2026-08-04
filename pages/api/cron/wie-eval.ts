// POST /api/cron/wie-eval — WIE Evaluation Suite orchestrator
import type { NextApiRequest, NextApiResponse } from 'next';
import { withOrgPaymentAccess } from '../../../lib/requireOrgPaymentAccess';
import { withCronWatchdog } from '../../../lib/cronWatchdog';
import { runWieEvalSuite } from '../../../lib/wie/eval/runEvalSuite';
import { writeTrendsFile, readHistory } from '../../../lib/wie/eval/history';
import { getErrorMessage } from '../../../lib/errors';

export const config = { maxDuration: 300 };

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET' && req.query.trends === '1') {
    const keyword = typeof req.query.keyword === 'string' ? req.query.keyword : undefined;
    const history = await readHistory(50);
    const trends = await writeTrendsFile(history, { keyword });
    return res.status(200).json({ trends: trends.markdown, regressions: trends.regressions });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
  const keyword = typeof body.keyword === 'string' ? body.keyword : undefined;
  const domainId = typeof body.domainId === 'number'
    ? body.domainId
    : body.domainId != null
      ? parseInt(String(body.domainId), 10)
      : undefined;
  const articleId = typeof body.articleId === 'number'
    ? body.articleId
    : body.articleId != null
      ? parseInt(String(body.articleId), 10)
      : undefined;

  if (!articleId && !(keyword && Number.isFinite(domainId))) {
    return res.status(400).json({
      error: 'Provide keyword+domainId or articleId',
    });
  }

  try {
    const result = await runWieEvalSuite({
      keyword,
      domainId: Number.isFinite(domainId as number) ? domainId : undefined,
      articleId: Number.isFinite(articleId as number) ? articleId : undefined,
      language: typeof body.language === 'string' ? body.language : undefined,
      skipDa: body.skipDa === true,
      skipGenerate: body.skipGenerate === true,
      skipAo: body.skipAo === true,
      skipJudge: body.skipJudge === true,
      benchmark: body.benchmark !== false,
    });
    return res.status(result.pipelineOk ? 200 : 422).json(result);
  } catch (e) {
    return res.status(500).json({ error: getErrorMessage(e) });
  }
}

export default withOrgPaymentAccess(withCronWatchdog('wie-eval', handler));
