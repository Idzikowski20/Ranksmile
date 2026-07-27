// POST /api/articles/fetch-site-links
// Fetches a URL and extracts all internal links from the page.
// Falls back to sitemap parsing, then Puppeteer for JS-rendered SPAs.
// Returns { links: [{ url, title }] }
import type { NextApiRequest, NextApiResponse } from 'next';
import verifyUser from '../../../utils/verifyUser';
import { renderPage } from '../../../utils/spaScraper';
import { ssrfSafeFetch } from '../../../lib/ssrfGuard';
import { getErrorMessage } from '../../../lib/errors';

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9,pl;q=0.8',
};

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

/** Heuristic: does this HTML look like a JS-rendered SPA with no real content? */
function isSpaShell(html: string): boolean {
  const rootDivs = (html.match(/<div\s[^>]*id=["'](?:root|app|__next|__nuxt)["'][^>]*>/gi) || []).length;
  const anchorCount = (html.match(/<a[\s>]/gi) || []).length;
  // SPA shell = has a root mount point AND fewer than 5 <a> tags
  return rootDivs > 0 && anchorCount < 5;
}

/** Try to fetch and parse a sitemap. Returns links or empty array.
 *  Probes all candidate paths concurrently so a missing sitemap doesn't cause a long delay. */
async function fetchSitemapLinks(origin: string, baseUrl: string): Promise<Array<{ url: string; title: string }>> {
  const sitemapPaths = ['/sitemap.xml', '/sitemap_index.xml', '/post-sitemap.xml', '/page-sitemap.xml'];
  const base = new URL(baseUrl);

  const tryPath = async (path: string): Promise<Array<{ url: string; title: string }> | null> => {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6_000);

      const res = await ssrfSafeFetch(`${origin}${path}`, {
        signal: controller.signal,
        headers: FETCH_HEADERS,
      });
      clearTimeout(timer);

      if (!res.ok) return null;

      const text = await res.text();
      if (!text.trimStart().startsWith('<')) return null;

      const locRegex = /<loc>([^<]+)<\/loc>/gi;
      const links: Array<{ url: string; title: string }> = [];
      const seen = new Set<string>();
      let m: RegExpExecArray | null;

      while ((m = locRegex.exec(text)) !== null) {
        try {
          const abs = new URL(m[1].trim());
          if (abs.hostname !== base.hostname) continue;
          const key = `${abs.origin}${abs.pathname}`;
          if (!abs.pathname || abs.pathname === '/' || seen.has(key)) continue;
          seen.add(key);
          links.push({ url: key, title: abs.pathname });
        } catch { /* skip bad URLs */ }
      }

      if (links.length > 0) {
        console.log(`[fetch-site-links] sitemap fallback (${path}) found ${links.length} links`);
        return links.slice(0, 80);
      }
      return null;
    } catch { return null; }
  };

  const results = await Promise.allSettled(sitemapPaths.map(tryPath));
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value && r.value.length > 0) return r.value;
  }

  return [];
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const authorized = await verifyUser(req, res);
  if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { url } = req.body as { url: string };
  if (!url) return res.status(400).json({ error: 'url is required' });

  let targetUrl: string;
  let base: URL;
  try {
    base = new URL(url);
    targetUrl = base.href;
  } catch {
    return res.status(400).json({ error: 'Invalid URL' });
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);

  try {
    // SSRF: assertPublicUrl on every hop (incl. redirects) via ssrfSafeFetch.
    const response = await ssrfSafeFetch(targetUrl, {
      signal: controller.signal,
      headers: FETCH_HEADERS,
    });
    clearTimeout(timer);

    if (!response.ok) {
      return res.status(400).json({ error: `Page returned ${response.status}` });
    }

    const html = await response.text();
    let links = extractLinks(html, targetUrl);
    const spaDetected = links.length === 0 && isSpaShell(html);

    // Fallback to sitemap for JS-rendered SPAs or pages with no detectable links
    if (links.length === 0) {
      links = await fetchSitemapLinks(base.origin, targetUrl);
    }

    // Fallback to Puppeteer for SPAs where sitemap also failed
    if (links.length === 0 && spaDetected) {
      try {
        console.log(`[fetch-site-links] SPA detected, trying puppeteer for ${targetUrl}`);
        const rendered = await renderPage(targetUrl);
        links = extractLinks(rendered.html, rendered.url);
        console.log(`[fetch-site-links] puppeteer found ${links.length} links at ${rendered.url}`);
      } catch (err) {
        console.warn('[fetch-site-links] puppeteer fallback failed:', getErrorMessage(err));
      }
    }

    if (links.length === 0) {
      const hint = spaDetected
        ? 'This page is JavaScript-rendered. Try providing a sitemap URL (e.g. /sitemap.xml) or a server-rendered page instead.'
        : 'No internal links found on that page. Try a different URL.';
      console.log(`[fetch-site-links] found 0 internal links at ${targetUrl}${spaDetected ? ' (SPA detected)' : ''}`);
      return res.status(200).json({ links: [], hint });
    }

    console.log(`[fetch-site-links] found ${links.length} internal links at ${targetUrl}${spaDetected ? ' (via sitemap fallback)' : ''}`);
    return res.status(200).json({ links });
  } catch (err) {
    clearTimeout(timer);
    if ((err as { name?: string })?.name === 'AbortError') return res.status(408).json({ error: 'Request timed out (15 s)' });
    const message = getErrorMessage(err);
    console.error('[fetch-site-links]', message);
    return res.status(500).json({ error: message || 'Failed to fetch URL' });
  }
}
