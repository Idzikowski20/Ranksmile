// POST /api/brand-knowledge — scrape a URL via the sidecar and draft Brand Knowledge.
import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import verifyUser from '../../utils/verifyUser';
import { sidecarUrl } from '../../lib/serviceUrls';
import { assertPublicUrl } from '../../lib/ssrfGuard';
import { getErrorMessage } from '../../lib/errors';

// Vercel: LLM/sidecar calls can take up to ~minutes; raise from the ~10s default.
export const config = { maxDuration: 60 };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const authorized = await verifyUser(req, res);
  if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { url } = req.body || {};
  if (!url || typeof url !== 'string') return res.status(400).json({ error: 'url is required' });

  try {
    await assertPublicUrl(url);
    const base = sidecarUrl();
    const r = await axios.post(`${base}/brand-knowledge`, { url }, { timeout: 60000, headers: { 'x-internal-token': process.env.INTERNAL_PIPELINE_TOKEN || '' } });
    return res.status(200).json({ brandName: r.data?.brand_name || '', brandKnowledge: r.data?.brand_knowledge || '' });
  } catch (err) {
    const message = getErrorMessage(err);
    if (message === 'Invalid URL' || message === 'Only http(s) URLs are allowed' || message.startsWith('Blocked ') || message === 'DNS resolution failed') {
      return res.status(400).json({ error: message || 'Blocked URL' });
    }
    const e = err as { response?: { data?: { detail?: string } }; message?: string };
    const detail = e?.response?.data?.detail || e?.message || 'Analysis failed';
    return res.status(502).json({ error: detail });
  }
}
