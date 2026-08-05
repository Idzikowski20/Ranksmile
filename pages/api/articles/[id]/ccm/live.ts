// POST /api/articles/[id]/ccm/live — live presence overlay (no persist, no new facts)
import type { NextApiRequest, NextApiResponse } from 'next';
import verifyUser from '../../../../../utils/verifyUser';
import { withOrgPaymentAccess } from '../../../../../lib/requireOrgPaymentAccess';
import { getCurrentUserId } from '../../../../../utils/getUser';
import { assertArticleAccess } from '../../../../../lib/tenancy';
import { getErrorMessage } from '../../../../../lib/errors';
import { ensureCcmTables } from '../../../../../lib/ensureCcmTables';
import { SqlCompileStore } from '../../../../../lib/intelligence/sqlCompileStore';
import { getCcm, projectArticleIntelligence } from '../../../../../lib/intelligence/runtimeApi';
import { applyLivePresence } from '../../../../../lib/intelligence/livePresence';
import { buildActionGraph } from '../../../../../lib/planner/actionGraphBuilder';

type Body = {
  plainText?: string;
  html?: string;
};

function htmlToPlain(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authorized = await verifyUser(req, res);
  if (authorized !== 'authorized') return res.status(401).json({ error: authorized });

  const articleId = parseInt(String(req.query.id), 10);
  if (!Number.isFinite(articleId)) return res.status(400).json({ error: 'Valid id required' });

  const userId = await getCurrentUserId(req, res);
  if (!(await assertArticleAccess(userId, articleId))) {
    return res.status(403).json({ error: 'Access denied.' });
  }

  const body = req.body && typeof req.body === 'object' ? (req.body as Body) : {};
  const plain =
    typeof body.plainText === 'string' && body.plainText.trim()
      ? body.plainText
      : typeof body.html === 'string'
        ? htmlToPlain(body.html)
        : '';
  if (!plain.trim()) return res.status(400).json({ error: 'plainText or html required' });

  try {
    await ensureCcmTables();
    const store = new SqlCompileStore();
    const model = await getCcm(String(articleId), store);
    if (!model) return res.status(404).json({ error: 'CCM not found' });

    const live = applyLivePresence(model, plain);
    const actionGraph = buildActionGraph(live.model, {
      builtAt: model.compiledAt,
    });
    const view = projectArticleIntelligence(live.model, actionGraph);

    return res.status(200).json({
      articleId,
      ccmId: model.ccmId,
      version: model.version,
      contentHash: model.contentHash,
      deterministicHash: model.compiler.deterministicHash,
      compiledAt: model.compiledAt,
      live: true,
      changed: live.changed,
      flippedCount: live.flippedNodeIds.length,
      actionCount: actionGraph.actions.length,
      view,
    });
  } catch (error) {
    return res.status(500).json({ error: getErrorMessage(error) || 'CCM live error' });
  }
}

export default withOrgPaymentAccess(handler);
