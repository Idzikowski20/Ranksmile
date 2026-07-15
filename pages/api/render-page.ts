// POST /api/render-page
// Renders a URL through headless Chrome and returns the full HTML.
// Used by the Python sidecar as fallback for JS-rendered SPAs.
import type { NextApiRequest, NextApiResponse } from 'next';
import verifyUser from '../../utils/verifyUser';
import { renderPage } from '../../utils/spaScraper';
import { assertPublicUrl } from '../../lib/ssrfGuard';
import { getErrorMessage } from '../../lib/errors';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { url, timeout } = req.body as { url: string; timeout?: number };
  if (!url) return res.status(400).json({ error: 'url is required' });

  // Internal endpoint (sidecar SPA fallback). In production the shared token is the only
  // trusted signal; reverse proxies commonly make external requests look like loopback peers.
  const internalToken = process.env.INTERNAL_PIPELINE_TOKEN;
  const headerToken = req.headers['x-internal-token'];
  const remote = req.socket?.remoteAddress || '';
  const isLoopbackPeer = remote === '127.0.0.1' || remote === '::1' || remote === '::ffff:127.0.0.1';
  const hasInternalToken = typeof headerToken === 'string' && !!internalToken && headerToken === internalToken;
  const allowLocalDevLoopback = process.env.NODE_ENV !== 'production' && !internalToken && isLoopbackPeer;
  const isInternal = hasInternalToken || allowLocalDevLoopback;
  if (!isInternal) {
    const authorized = await verifyUser(req, res);
    if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
  }

  // SSRF guard: even internal callers only ever render PUBLIC pages — block file:/private IPs/metadata.
  try { await assertPublicUrl(url); } catch (e) { return res.status(400).json({ error: getErrorMessage(e) || 'Blocked URL' }); }

  try {
    const result = await renderPage(url, timeout || 20_000);
    return res.status(200).json({ html: result.html, url: result.url });
  } catch (err) {
    const msg = getErrorMessage(err);
    console.error('[render-page]', msg);
    return res.status(500).json({ error: msg || 'Failed to render page' });
  }
}
