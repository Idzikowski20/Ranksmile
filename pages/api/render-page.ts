// POST /api/render-page
// Renders a URL through headless Chrome and returns the full HTML.
// Used by the Python sidecar as fallback for JS-rendered SPAs.
import type { NextApiRequest, NextApiResponse } from 'next';
import verifyUser from '../../utils/verifyUser';
import { renderPage } from '../../utils/spaScraper';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { url, timeout } = req.body as { url: string; timeout?: number };
  if (!url) return res.status(400).json({ error: 'url is required' });

  // Internal endpoint — skip auth when called from sidecar on localhost
  const isLocalhost = req.headers.host?.startsWith('127.0.0.1') || req.headers.host?.startsWith('localhost');
  if (!isLocalhost) {
    const authorized = await verifyUser(req, res);
    if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
  }

  try {
    const result = await renderPage(url, timeout || 20_000);
    return res.status(200).json({ html: result.html, url: result.url });
  } catch (err: any) {
    console.error('[render-page]', err.message);
    return res.status(500).json({ error: err.message || 'Failed to render page' });
  }
}
