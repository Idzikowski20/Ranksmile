// POST /api/articles/[id]/execute-action — Action → Executor (LLM/WP/manual)
import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../../database/database';
import verifyUser from '../../../../utils/verifyUser';
import { getCurrentUserId } from '../../../../utils/getUser';
import { assertArticleAccess } from '../../../../lib/tenancy';
import { getErrorMessage } from '../../../../lib/errors';
import { runActionExecution } from '../../../../lib/runActionExecution';
import type { Action } from '../../../../lib/primitives/types';
import {
  ensureDomainEventTables,
  ensureKnowledgeLayerTables,
} from '../../../../lib/ensureGrowthMetaTables';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await db.sync();
  await ensureDomainEventTables().catch(() => {});
  await ensureKnowledgeLayerTables().catch(() => {});
  const authorized = await verifyUser(req, res);
  if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const articleId = parseInt(String(req.query.id), 10);
  if (!Number.isFinite(articleId)) return res.status(400).json({ error: 'Valid id required' });

  const userId = await getCurrentUserId(req, res);
  if (!(await assertArticleAccess(userId, articleId))) {
    return res.status(403).json({ error: 'Access denied.' });
  }

  const body = req.body as { action?: Action; confirmed?: boolean; domainId?: number };
  if (!body?.action?.id || !body.action.type) {
    return res.status(400).json({ error: 'action.id and action.type required' });
  }

  try {
    const execution = await runActionExecution({
      action: body.action,
      articleId,
      domainId: body.domainId,
      confirmed: !!body.confirmed,
    });
    return res.status(200).json({ execution });
  } catch (err: unknown) {
    return res.status(500).json({ error: getErrorMessage(err) });
  }
}
