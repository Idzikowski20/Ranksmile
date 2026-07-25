// POST /api/domains/detect-blog-paths { domain, siteUrl } → { blogPaths: string[] }
import type { NextApiRequest, NextApiResponse } from 'next';
import verifyUser from '../../../utils/verifyUser';
import { rankBlogSegments } from '../../../lib/detectBlogPaths';
import { fetchSitemapUrls } from '../../../lib/fetchSitemapUrls';
import { assertPublicUrl } from '../../../lib/ssrfGuard';

import { RANKSMILE_UA } from '../../../lib/httpConstants';

/** True if a page shows article signals: JSON-LD Article/BlogPosting, datePublished, <article>, or RSS link. */
async function hasArticleSignals(url: string): Promise<boolean> {
   try {
      await assertPublicUrl(url); // second-order SSRF: url comes from the fetched sitemap's <loc>
      const r = await fetch(url, { headers: { 'User-Agent': RANKSMILE_UA } });
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
