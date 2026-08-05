// POST /api/wie/write — shared WIE Writer (Think context → LLM → Judge)
import type { NextApiRequest, NextApiResponse } from 'next';
import verifyUser from '../../../utils/verifyUser';
import { withOrgPaymentAccess } from '../../../lib/requireOrgPaymentAccess';
import { wieWrite } from '../../../lib/wie/writer';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const authorized = await verifyUser(req, res);
  if (authorized !== 'authorized') return res.status(401).json({ error: authorized });

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body && typeof req.body === 'object' ? req.body as Record<string, unknown> : {};
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  if (!prompt) return res.status(400).json({ error: 'prompt required' });

  const keyword = typeof body.keyword === 'string' ? body.keyword : undefined;
  const action = typeof body.action === 'string' ? body.action : 'rewrite_section';
  const injectWieBlocks = body.injectWieBlocks !== false;
  const requireEeat = body.requireEeat !== false;

  try {
    const result = await wieWrite({
      userPrompt: prompt,
      keyword,
      action,
      injectWieBlocks: !!keyword && injectWieBlocks,
      requireEeat,
    });
    return res.status(result.judge.ok ? 200 : 422).json({
      html: result.html,
      tokens: result.tokens,
      judge: result.judge,
      dna_version: result.wie?.policy?.dna_version,
      explainability: result.wie?.explainability,
    });
  } catch (e) {
    return res.status(500).json({
      error: e instanceof Error ? e.message : 'write_failed',
    });
  }
}

export default withOrgPaymentAccess(handler);
