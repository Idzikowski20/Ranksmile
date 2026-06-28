// POST /api/brand-knowledge — scrape a URL via the sidecar and draft Brand Knowledge.
import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import verifyUser from '../../utils/verifyUser';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const authorized = await verifyUser(req, res);
  if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { url } = req.body || {};
  if (!url || typeof url !== 'string') return res.status(400).json({ error: 'url is required' });

  try {
    const sidecarUrl = (process.env.PYTHON_SIDECAR_URL || 'http://127.0.0.1:8001').replace('localhost', '127.0.0.1');
    const r = await axios.post(`${sidecarUrl}/brand-knowledge`, { url }, { timeout: 60000, headers: { 'x-internal-token': process.env.INTERNAL_PIPELINE_TOKEN || '' } });
    return res.status(200).json({ brandName: r.data?.brand_name || '', brandKnowledge: r.data?.brand_knowledge || '' });
  } catch (e: any) {
    const detail = e?.response?.data?.detail || e?.message || 'Analysis failed';
    return res.status(502).json({ error: detail });
  }
}
