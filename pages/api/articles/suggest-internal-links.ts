// POST /api/articles/suggest-internal-links
// Uses DeepSeek to find natural anchor-text placements for internal links.
// Caches result in internal_links_cache column per article.
//
// Input:  { articleId, content, keyword, articles: [{id, title, url}] }
// Output: { suggestions: [{ anchorText, articleId, articleTitle, url, context }] }
import type { NextApiRequest, NextApiResponse } from 'next';
import verifyUser from '../../../utils/verifyUser';
import db from '../../../database/database';
import { ensureArticlesTables } from '../../../lib/ensureArticlesTables';

export interface LinkSuggestion {
  anchorText: string;
  articleId: number;
  articleTitle: string;
  url: string;
  context: string; // short excerpt showing the anchor in context
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const authorized = await verifyUser(req, res);
  if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  await ensureArticlesTables();

  const { articleId, content, keyword, articles } = req.body as {
    articleId: number;
    content: string;
    keyword: string;
    articles: Array<{ id: number; title: string; url: string }>;
  };

  if (!content) return res.status(400).json({ error: 'content is required' });
  if (!articles?.length) return res.status(200).json({ suggestions: [] });

  // ── Return from DB cache if available ────────────────────────────
  if (articleId) {
    try {
      const [rows] = await db.query(
        `SELECT internal_links_cache FROM articles WHERE id = ? LIMIT 1`,
        { replacements: [articleId] },
      );
      const cached = (rows as any[])[0]?.internal_links_cache;
      if (cached) {
        console.log(`[internal-links] serving cache for article ${articleId}`);
        return res.status(200).json(JSON.parse(cached));
      }
    } catch (e: any) {
      console.warn('[internal-links] cache read failed:', e.message);
    }
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'DEEPSEEK_API_KEY not configured' });

  // Truncate content to keep prompt reasonable (first ~12000 chars)
  const trimmedContent = content.length > 12000 ? content.slice(0, 12000) + '…' : content;

  const articleList = articles
    .map((a, i) => `${i + 1}. ID=${a.id} | Title: "${a.title}" | URL: ${a.url}`)
    .join('\n');

  const prompt = `You are an SEO specialist. Analyze this article and find ALL natural internal linking opportunities.

ARTICLE KEYWORD: "${keyword}"

ARTICLE CONTENT:
${trimmedContent}

AVAILABLE INTERNAL LINKS (link to these articles):
${articleList}

TASK:
Find every phrase in the article content that would naturally serve as anchor text for one of the available articles above.
Rules:
- Match based on semantic relevance, not just exact title match
- Each available article can appear at most ONCE as a suggestion
- Only suggest links where the anchor text appears VERBATIM in the article content
- Pick the most natural, contextually relevant phrase for each link
- Prefer longer, more specific phrases over single words

OUTPUT FORMAT — JSON array only, no other text:
[
  {
    "anchorText": "exact phrase from the article",
    "articleId": <number>,
    "articleTitle": "title of the target article",
    "url": "url of the target article",
    "context": "...short excerpt of ~10 words surrounding the anchor text..."
  }
]

If no natural links found, return: []`;

  try {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('[internal-links] DeepSeek error:', err);
      return res.status(500).json({ error: 'AI request failed' });
    }

    const data = await response.json();
    const raw: string = data.choices?.[0]?.message?.content || '[]';

    // Extract JSON array from response (model may wrap in ```json blocks)
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.warn('[internal-links] no JSON array found in response:', raw.slice(0, 200));
      return res.status(200).json({ suggestions: [] });
    }

    const suggestions: LinkSuggestion[] = JSON.parse(jsonMatch[0]);

    console.log(`[internal-links] found ${suggestions.length} suggestions for article ${articleId}`);

    const result = { suggestions };

    // ── Save to DB cache ──────────────────────────────────────────
    if (articleId && suggestions.length > 0) {
      try {
        await db.query(
          `UPDATE articles SET internal_links_cache = ?, updated_at = datetime('now') WHERE id = ?`,
          { replacements: [JSON.stringify(result), articleId] },
        );
      } catch (e: any) {
        console.warn('[internal-links] cache write failed:', e.message);
      }
    }

    return res.status(200).json(result);
  } catch (err: any) {
    console.error('[internal-links] error:', err?.message);
    return res.status(500).json({ error: err?.message || 'Analysis failed' });
  }
}
