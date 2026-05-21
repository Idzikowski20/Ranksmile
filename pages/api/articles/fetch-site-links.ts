// POST /api/articles/fetch-site-links
// Fetches a URL and extracts all internal links from the page.
// Returns { links: [{ url, title }] }
import type { NextApiRequest, NextApiResponse } from 'next';
import verifyUser from '../../../utils/verifyUser';

function extractLinks(html: string, baseUrl: string): Array<{ url: string; title: string }> {
  let base: URL;
  try { base = new URL(baseUrl); } catch { return []; }

  const seen = new Set<string>();
  const links: Array<{ url: string; title: string }> = [];

  const regex = /<a\s[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(html)) !== null) {
    try {
      const href = match[1].trim();
      const rawTitle = match[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

      // Resolve to absolute URL
      const abs = new URL(href, baseUrl);

      // Only internal links (same hostname)
      if (abs.hostname !== base.hostname) continue;

      // Skip trivial paths
      if (!abs.pathname || abs.pathname === '/' || abs.pathname === base.pathname) continue;

      // Normalise: strip hash + query for dedup key
      const key = `${abs.origin}${abs.pathname}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const title = rawTitle || abs.pathname;
      links.push({ url: key, title });
    } catch { /* ignore malformed href */ }
  }

  return links.slice(0, 80);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const authorized = await verifyUser(req, res);
  if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { url } = req.body as { url: string };
  if (!url) return res.status(400).json({ error: 'url is required' });

  let targetUrl: string;
  try {
    targetUrl = new URL(url).href;
  } catch {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,pl;q=0.8',
      },
    });
    clearTimeout(timer);

    if (!response.ok) {
      return res.status(400).json({ error: `Page returned ${response.status}` });
    }

    const html = await response.text();
    const links = extractLinks(html, targetUrl);

    console.log(`[fetch-site-links] found ${links.length} internal links at ${targetUrl}`);
    return res.status(200).json({ links });
  } catch (err: any) {
    clearTimeout(timer);
    if (err.name === 'AbortError') return res.status(408).json({ error: 'Request timed out (15 s)' });
    console.error('[fetch-site-links]', err.message);
    return res.status(500).json({ error: err.message || 'Failed to fetch URL' });
  }
}
