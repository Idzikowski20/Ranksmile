import type { NextApiRequest, NextApiResponse } from 'next';
import verifyUser from '../../../utils/verifyUser';
import { getCurrentUserId } from '../../../utils/getUser';
import {
  enqueueAnalyzeDag,
  FlowProducerStageError,
} from '../../../lib/pipeline/flowProducer';
import { getPipelineStage } from '../../../lib/pipeline/pipelineStage';
import { withOrgPaymentAccess } from '../../../lib/requireOrgPaymentAccess';

/**
 * POST /api/pipeline/analyze — Etap 2+ FlowProducer DAG (or sequential fallback).
 * Requires PIPELINE_STAGE >= 2. Returns 202 Accepted.
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
  const keyword = String(body.keyword || '').trim();
  if (!keyword) {
    res.status(400).json({ error: 'keyword required' });
    return;
  }

  const userId = await getCurrentUserId(req, res);
  const workspaceId = String(body.workspaceId ?? userId ?? '0');

  try {
    const result = await enqueueAnalyzeDag({
      workspaceId,
      keyword,
      language: body.language != null ? String(body.language) : undefined,
      country: body.country != null ? String(body.country) : undefined,
      payload:
        body.payload && typeof body.payload === 'object'
          ? (body.payload as Record<string, unknown>)
          : { ...body, workspaceId, keyword },
    });
    res.status(202).json({ accepted: true, status: 202, ...result });
  } catch (err: unknown) {
    if (err instanceof FlowProducerStageError) {
      res.status(403).json({
        error: err.message,
        stage: err.stage,
        hint: 'Set PIPELINE_STAGE=2 (or higher) to enable FlowProducer DAG',
        currentStage: getPipelineStage(),
      });
      return;
    }
    throw err;
  }
}

export default withOrgPaymentAccess(handler);
