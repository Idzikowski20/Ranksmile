import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../../../database/database';
import verifyUser from '../../../../../utils/verifyUser';
import { ensureArticlesTables } from '../../../../../lib/ensureArticlesTables';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await db.sync();
  await ensureArticlesTables();
  const authorized = await verifyUser(req, res);
  if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { id } = req.query;

  // Get article keywords + competitor outlines cache
  const [articles] = await db.query(
    `SELECT competitor_outlines_cache FROM articles WHERE id = ?`,
    { replacements: [id] },
  );
  const art = (articles as any[])[0];

  const [keywords] = await db.query(
    `SELECT keyword FROM article_keywords WHERE article_id = ?`,
    { replacements: [id] },
  );
  const ourKeywords = new Set((keywords as any[]).map((r: any) => r.keyword.toLowerCase()));

  // Extract competitor keywords from cached outlines
  const gapFreq: Record<string, number> = {};
  if (art?.competitor_outlines_cache) {
    try {
      const outlines = typeof art.competitor_outlines_cache === 'string'
        ? JSON.parse(art.competitor_outlines_cache)
        : art.competitor_outlines_cache;

      const competitorHeadings: string[] = [];
      if (Array.isArray(outlines)) {
        for (const comp of outlines) {
          if (comp.outline) {
            for (const h of comp.outline) {
              if (h.text) competitorHeadings.push(h.text.toLowerCase());
            }
          }
        }
      }

      // Extract meaningful n-grams from competitor headings
      for (const heading of competitorHeadings) {
        const words = heading.split(/\s+/).filter((w: string) => w.length > 3);
        for (let len = 2; len <= Math.min(4, words.length); len++) {
          for (let i = 0; i <= words.length - len; i++) {
            const phrase = words.slice(i, i + len).join(' ');
            if (!ourKeywords.has(phrase)) {
              gapFreq[phrase] = (gapFreq[phrase] || 0) + 1;
            }
          }
        }
      }
    } catch { /* malformed cache — ok */ }
  }

  // Sort by frequency and return top 20
  const gapKeywords = Object.entries(gapFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([keyword, frequency]) => ({ keyword, frequency }));

  return res.status(200).json({ gapKeywords });
}
