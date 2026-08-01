// GET /api/rank-tracking/:slug/organic-keyword-history?keyword=
import type { NextApiRequest, NextApiResponse } from 'next';
import { getErrorMessage } from '../../../../lib/errors';
import { loadOrganicKeywordPositionHistory } from '../../../../lib/organicResearch/keywordHistory';
import { resolveRankTrackingApi } from '../../../../lib/rankTracking/apiAuth';
import { withOrgPaymentAccess } from '../../../../lib/requireOrgPaymentAccess';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const ctx = await resolveRankTrackingApi(req, res, { requireUi: false });
  if (!ctx) return;
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const keyword = typeof req.query.keyword === 'string' ? req.query.keyword.trim() : '';
  if (!keyword) return res.status(400).json({ error: 'keyword is required' });

  const position = req.query.position != null ? Number(req.query.position) : null;
  const previousPosition = req.query.previousPosition != null ? Number(req.query.previousPosition) : null;
  const change30d = req.query.change30d != null ? Number(req.query.change30d) : null;
  const updatedAt = typeof req.query.updatedAt === 'string' ? req.query.updatedAt : null;

  try {
    const { points, source } = await loadOrganicKeywordPositionHistory({
      domainId: ctx.domainId,
      keyword,
      position: Number.isFinite(position) ? position : null,
      previousPosition: Number.isFinite(previousPosition) ? previousPosition : null,
      change30d: Number.isFinite(change30d) ? change30d : null,
      updatedAt,
    });
    res.setHeader('Cache-Control', 'private, max-age=300');
    return res.status(200).json({ points, source });
  } catch (e) {
    return res.status(500).json({ error: getErrorMessage(e) });
  }
}

export default withOrgPaymentAccess(handler);
