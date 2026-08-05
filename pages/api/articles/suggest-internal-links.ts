// POST /api/articles/suggest-internal-links
// Uses DeepSeek to find natural anchor-text placements for internal links.
// Caches result in internal_links_cache column per article.
//
// Input:  { articleId, content, keyword, articles: [{id, title, url}] }
// Output: { suggestions: [{ anchorText, articleId, articleTitle, url, context }] }
import type { NextApiRequest, NextApiResponse } from 'next';
import verifyUser from '../../../utils/verifyUser';
import db from '../../../database/database';
import { resolveOrgId, orgBudgetBlocked, recordAiTokens } from '../../../lib/aiBudget';
import { ensureArticlesTables } from '../../../lib/ensureArticlesTables';
import { getArticleIdSql } from '../../../lib/articleSql';
import { getErrorMessage } from '../../../lib/errors';
import { queryOne } from '../../../lib/db/query';
import { getCurrentUserId } from '../../../utils/getUser';
import { assertArticleAccess } from '../../../lib/tenancy';
import { withOrgPaymentAccess } from '../../../lib/requireOrgPaymentAccess';
import { chatLlm } from '../../../lib/ai/deepseek';

export interface LinkSuggestion {
  anchorText: string;
  articleId: number;
  articleTitle: string;
  url: string;
  context: string; // short excerpt showing the anchor in context
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
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

  if (articleId) {
    const userId = await getCurrentUserId(req, res);
    if (!(await assertArticleAccess(userId, Number(articleId)))) {
      return res.status(403).json({ error: 'Access denied.' });
    }
  }

  // ── Return from DB cache if available ────────────────────────────
  if (articleId) {
    try {
      const articleIdSql = await getArticleIdSql();
      const row = await queryOne<{ internal_links_cache: string | null }>(
        `SELECT internal_links_cache FROM articles WHERE ${articleIdSql} = ? LIMIT 1`,
        [articleId],
      );
      const cached = row?.internal_links_cache;
      if (cached) {
        console.log(`[internal-links] serving cache for article ${articleId}`);
        return res.status(200).json(JSON.parse(cached));
      }
    } catch (e) {
      console.warn('[internal-links] cache read failed:', getErrorMessage(e));
    }
  }

  const llm = chatLlm();
  if (!llm.apiKey) return res.status(500).json({ error: `${llm.keyEnv} not configured` });

  // Org-wide AI budget (gate after the free cache return above).
  const orgId = await resolveOrgId(req, res);
  const over = await orgBudgetBlocked(orgId);
  if (over) return res.status(429).json(over);

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
    const response = await fetch(llm.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${llm.apiKey}` },
      body: JSON.stringify({
        model: llm.model,
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
    void recordAiTokens(orgId, data.usage?.total_tokens || 0);
    const raw: string = data.choices?.[0]?.message?.content || '[]';

    // Extract JSON array from response (model may wrap in ```json blocks)
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.warn('[internal-links] no JSON array found in response:', raw.slice(0, 200));
      return res.status(200).json({ suggestions: [] });
    }

    // A truncated array (hit max_tokens) or bracket-bearing prose makes the regex match but the
    // parse throw — degrade to empty suggestions instead of a 500.
    let suggestions: LinkSuggestion[] = [];
    try { suggestions = JSON.parse(jsonMatch[0]); } catch { return res.status(200).json({ suggestions: [] }); }

    console.log(`[internal-links] found ${suggestions.length} suggestions for article ${articleId}`);

    const result = { suggestions };

    // ── Save to DB cache ──────────────────────────────────────────
    if (articleId && suggestions.length > 0) {
      try {
        const articleIdSql = await getArticleIdSql();
        await db.query(
          `UPDATE articles SET internal_links_cache = ?, updated_at = CURRENT_TIMESTAMP WHERE ${articleIdSql} = ?`,
          { replacements: [JSON.stringify(result), articleId] },
        );
      } catch (e) {
        console.warn('[internal-links] cache write failed:', getErrorMessage(e));
      }
    }

    return res.status(200).json(result);
  } catch (err) {
    console.error('[internal-links] error:', getErrorMessage(err));
    return res.status(500).json({ error: getErrorMessage(err) || 'Analysis failed' });
  }
}

export default withOrgPaymentAccess(handler);
