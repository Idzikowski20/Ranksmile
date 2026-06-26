// POST /api/domains/detect-blog-paths { domain, siteUrl } → { blogPaths: string[] }
import type { NextApiRequest, NextApiResponse } from 'next';
import verifyUser from '../../../utils/verifyUser';
import { rankBlogSegments } from '../../../lib/detectBlogPaths';

const UA = 'Mozilla/5.0 (compatible; SerpBearBot/1.0)';

async function fetchSitemapUrls(domain: string): Promise<string[]> {
   const base = domain.startsWith('http') ? domain : `https://${domain}`;
   for (const path of ['/sitemap.xml', '/sitemap_index.xml']) {
      try {
         const r = await fetch(`${base}${path}`, { headers: { 'User-Agent': UA } });
         if (!r.ok) continue;
         const xml = await r.text();
         const locs = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1]);
         if (locs.length) return locs.slice(0, 2000);
      } catch { /* try next */ }
   }
   return [];
}

/** True if a page shows article signals: JSON-LD Article/BlogPosting, datePublished, <article>, or RSS link. */
async function hasArticleSignals(url: string): Promise<boolean> {
   try {
      const r = await fetch(url, { headers: { 'User-Agent': UA } });
      if (!r.ok) return false;
      const html = (await r.text()).slice(0, 200_000);
      return /"@type"\s*:\s*"(Article|BlogPosting|NewsArticle)"/i.test(html)
         || /datePublished/i.test(html)
         || /<article[\s>]/i.test(html)
         || /<link[^>]+type=["']application\/rss\+xml["']/i.test(html);
   } catch { return false; }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   const authorized = await verifyUser(req, res);
   if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
   if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }); }

   const domain = (req.body?.domain as string || '').trim();
   if (!domain) return res.status(400).json({ error: 'domain is required' });

   const urls = await fetchSitemapUrls(domain);
   const ranked = rankBlogSegments(urls);
   if (ranked.length === 0) return res.status(200).json({ blogPaths: [] });

   // Confirm the top 2 candidates with article signals from a sample child url.
   const confirmed: string[] = [];
   for (const cand of ranked.slice(0, 2)) {
      const sample = urls.find((u) => {
         try { return new URL(u).pathname.toLowerCase().includes(`/${cand.segment}/`); } catch { return false; }
      });
      const ok = sample ? await hasArticleSignals(sample) : false;
      // Keep the strongest candidate even if signal probe failed (slug density already strong).
      if (ok || (confirmed.length === 0 && cand.slugChildren >= 3)) confirmed.push(`/${cand.segment}/`);
   }
   return res.status(200).json({ blogPaths: confirmed });
}
