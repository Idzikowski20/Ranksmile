import type { NextApiRequest, NextApiResponse } from 'next';
import verifyUser from '../../../utils/verifyUser';
import { getCurrentUserId } from '../../../utils/getUser';
import { enqueueJob, PipelineQueueDisabledError } from '../../../lib/pipeline/pipelineQueue';
import type { QueueName } from '../../../lib/pipeline/queuePriorities';
import { QUEUE_PRIORITY } from '../../../lib/pipeline/queuePriorities';
import { isQueueEnabled } from '../../../lib/workers/registry';
import { getPipelineStage } from '../../../lib/pipeline/pipelineStage';
import { withOrgPaymentAccess } from '../../../lib/requireOrgPaymentAccess';

/**
 * POST /api/pipeline/enqueue
 * Body: { queue, keyword, workspaceId?, language?, payload?, force? }
 * Returns 202 Accepted.
 */
async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const authorized = await verifyUser(req, res);
  if (authorized !== 'authorized') {
    res.status(401).json({ error: authorized });
    return;
  }

  const body = (req.body || {}) as Record<string, unknown>;
  const queue = String(body.queue || '') as QueueName;
  if (!queue || !(queue in QUEUE_PRIORITY)) {
    res.status(400).json({ error: 'invalid queue' });
    return;
  }

  if (!isQueueEnabled(queue)) {
    res.status(400).json({
      error: `queue "${queue}" not enabled at PIPELINE_STAGE=${getPipelineStage()}`,
      stage: getPipelineStage(),
    });
    return;
  }

  const keyword = String(body.keyword || '').trim();
  if (!keyword && queue !== 'live_score') {
    res.status(400).json({ error: 'keyword required' });
    return;
  }

  const userId = await getCurrentUserId(req, res);
  const workspaceId = body.workspaceId ?? userId ?? '0';
  const payload =
    body.payload && typeof body.payload === 'object'
      ? (body.payload as Record<string, unknown>)
      : { ...body };

  try {
    const result = await enqueueJob({
      workspaceId: String(workspaceId),
      keyword: keyword || '_',
      locale: body.language != null ? String(body.language) : undefined,
      country: body.country != null ? String(body.country) : undefined,
      queue,
      payload,
      force: !!body.force,
    });
    res.status(202).json(result);
  } catch (err: unknown) {
    if (err instanceof PipelineQueueDisabledError) {
      res.status(400).json({ error: err.message, stage: err.stage, queue: err.queue });
      return;
    }
    throw err;
  }
}

export default withOrgPaymentAccess(handler);
