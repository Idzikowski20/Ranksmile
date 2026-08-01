import type { NextApiRequest, NextApiResponse } from 'next';
import { getErrorMessage } from '../../../../lib/errors';
import { resolveRankTrackingApi } from '../../../../lib/rankTracking/apiAuth';
import { isRankTrackingRunnerEnabled } from '../../../../lib/featureFlags';
import { addKeywords, getConfig, listKeywords, removeKeywords, triggerManualCheck } from '../../../../lib/rankTracking/service';
import { MAX_KEYWORDS_PER_CONFIG } from '../../../../lib/rankTracking/cost';
import { withOrgPaymentAccess } from '../../../../lib/requireOrgPaymentAccess';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const ctx = await resolveRankTrackingApi(req, res);
  if (!ctx) return;

  const configId = Number(req.query.configId ?? (req.body as { configId?: unknown })?.configId);
  if (!Number.isFinite(configId)) return res.status(400).json({ error: 'configId is required' });

  const config = await getConfig(configId, ctx.domainId);
  if (!config) return res.status(404).json({ error: 'Config not found' });

  if (req.method === 'GET') {
    const keywords = await listKeywords(configId);
    return res.status(200).json({ keywords, limit: MAX_KEYWORDS_PER_CONFIG });
  }

  if (req.method === 'POST') {
    const body = (req.body || {}) as { keywords?: unknown };
    const raw = Array.isArray(body.keywords) ? body.keywords : [];
    const keywords = raw.filter((k): k is string => typeof k === 'string').map((k) => k.trim()).filter(Boolean);
    if (!keywords.length) return res.status(400).json({ error: 'keywords array is required' });
    try {
      const before = await listKeywords(configId);
      const ids = await addKeywords(configId, keywords);
      if (ids.length) {
        console.info('[rank-tracking] keyword_added', JSON.stringify({ configId, count: ids.length, domainId: ctx.domainId }));
      }
      const after = await listKeywords(configId);
      if (ids.length === 0 && keywords.length > 0 && before.length >= MAX_KEYWORDS_PER_CONFIG) {
        return res.status(400).json({ error: `Keyword limit reached (${MAX_KEYWORDS_PER_CONFIG})` });
      }
      let run: { runId: number } | null = null;
      if (isRankTrackingRunnerEnabled() && ids.length > 0) {
        try {
          const triggered = await triggerManualCheck(ctx.domainId, configId);
          if (triggered.ok) run = { runId: triggered.runId };
        } catch (e) {
          console.warn('[rank-tracking] auto-check after add failed:', getErrorMessage(e));
        }
      }
      return res.status(201).json({ ids, keywords: after, run, limit: MAX_KEYWORDS_PER_CONFIG });
    } catch (e) {
      return res.status(500).json({ error: getErrorMessage(e) });
    }
  }

  if (req.method === 'DELETE') {
    const body = (req.body || {}) as { keywordIds?: unknown };
    const ids = Array.isArray(body.keywordIds)
      ? body.keywordIds.map((id) => Number(id)).filter((id) => Number.isFinite(id))
      : [];
    if (!ids.length) return res.status(400).json({ error: 'keywordIds is required' });
    try {
      await removeKeywords(configId, ids);
      console.info('[rank-tracking] keyword_archived', JSON.stringify({ configId, count: ids.length, domainId: ctx.domainId }));
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: getErrorMessage(e) });
    }
  }

  res.setHeader('Allow', 'GET, POST, DELETE');
  return res.status(405).json({ error: 'Method not allowed' });
}

export default withOrgPaymentAccess(handler);
