// POST /api/articles/[id]/generate
// Generates article content INTO an existing article (created by deep-analysis),
// reusing its target keyword + analysis. Calls the Python sidecar /generate and
// writes the result back to the same article row.
import type { NextApiRequest, NextApiResponse } from 'next';
import { QueryTypes } from 'sequelize';
import axios from 'axios';
import db from '../../../../database/database';
import verifyUser from '../../../../utils/verifyUser';
import { ensureArticlesTables } from '../../../../lib/ensureArticlesTables';
import { getArticleIdSql } from '../../../../lib/articleSql';
import { readContentSettings } from '../../../../lib/contentSettings';
import { getCurrentUserId } from '../../../../utils/getUser';
import { assertArticleAccess } from '../../../../lib/tenancy';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await db.sync();
  await ensureArticlesTables();
  const authorized = await verifyUser(req, res);
  if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const userId = await getCurrentUserId(req, res);
  const articleIdNum = parseInt((req.query.id ?? req.query.articleId) as string, 10);
  if (!(await assertArticleAccess(userId, articleIdNum))) {
    return res.status(403).json({ error: 'Access denied.' });
  }

  const articleId = req.query.id;
  const {
    language = 'pl', tone = 'professional',
    contentType, instructions = '', voiceId = 'serp',
    internalLinks = true, externalLinks = true, reviewOutline = false,
  } = req.body || {};

  try {
    const articleIdSql = await getArticleIdSql();

    // 1. Load the existing article (keyword + domain + analysed language)
    const articleRows = await db.query<{ target_keyword: string; domain_id: number; language: string }>(
      `SELECT target_keyword, domain_id, language FROM articles WHERE ${articleIdSql} = ? LIMIT 1`,
      { replacements: [articleId], type: QueryTypes.SELECT },
    );
    const article = articleRows[0];
    if (!article) return res.status(404).json({ error: 'Article not found' });
    const keyword = article.target_keyword;
    if (!keyword) return res.status(400).json({ error: 'Article has no target keyword' });
    const lang = article.language || language;

    // 2. Domain
    const domainRows = await db.query<{ domain: string }>(
      `SELECT domain FROM domain WHERE "ID" = ? LIMIT 1`,
      { replacements: [article.domain_id], type: QueryTypes.SELECT },
    );
    const domainName = domainRows[0]?.domain || '';

    // 3. Existing published articles for internal linking
    const existing = await db.query<{ id: number; title: string; meta_url: string }>(
      `SELECT id, title, meta_url FROM articles
       WHERE domain_id = ? AND status = 'published' AND meta_url IS NOT NULL AND meta_url != ''
       ORDER BY created_at DESC LIMIT 30`,
      { replacements: [article.domain_id], type: QueryTypes.SELECT },
    );
    const domainArticles = existing.map((a) => ({
      id: a.id, title: a.title, url: `https://${domainName}/${(a.meta_url || '').replace(/^\//, '')}`,
    }));

    // 4. Resolve shared content settings — Brand Knowledge + selected voice tone.
    const cs = await readContentSettings();
    const brandKnowledge = cs.brandKnowledge || '';
    const selectedVoice = voiceId && voiceId !== 'serp' ? cs.voices.find((v) => v.id === voiceId) : undefined;
    const voiceTone = selectedVoice?.description || '';

    // 5. Call the sidecar with all wizard + brand context.
    const sidecarUrl = (process.env.PYTHON_SIDECAR_URL || 'http://127.0.0.1:8001').replace('localhost', '127.0.0.1');
    let data: any;
    try {
      const resp = await axios.post(`${sidecarUrl}/generate`, {
        url: `https://${domainName}`, keyword, language: lang, tone, existing_articles: domainArticles,
        content_type: contentType, instructions, internal_links: internalLinks, external_links: externalLinks, review_outline: reviewOutline,
        brand_knowledge: brandKnowledge, voice_tone: voiceTone,
      }, { timeout: 300000 });
      data = resp.data;
    } catch (sidecarError: any) {
      const detail = sidecarError?.response?.data || sidecarError?.message || 'sidecar unavailable';
      console.error('[articles/[id]/generate] sidecar error:', detail);
      return res.status(502).json({ error: 'Generation service unavailable', detail });
    }

    const html: string = data.article_html || '';
    const wordCount = html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;

    // 5. Write the generated content back to the SAME article
    await db.query(
      `UPDATE articles SET
         title = ?, content = ?, meta_title = ?, meta_description = ?, meta_url = ?,
         schema_json = ?, score_data = ?, internal_links_cache = ?, word_count = ?,
         status = 'draft', updated_at = CURRENT_TIMESTAMP
       WHERE ${articleIdSql} = ?`,
      {
        replacements: [
          data.meta_title || keyword,
          html,
          data.meta_title || keyword,
          data.meta_description || '',
          data.meta_url || '',
          JSON.stringify(data.article_schema || data.schema_json || {}),
          JSON.stringify(data.score_data || {}),
          JSON.stringify({ suggestions: data.internal_links || [] }),
          wordCount,
          articleId,
        ],
        type: QueryTypes.UPDATE,
      },
    );

    return res.status(200).json({ articleId, ok: true, word_count: wordCount });
  } catch (error: any) {
    console.error('[articles/[id]/generate] error:', error);
    return res.status(500).json({ error: error?.message || 'Generation failed' });
  }
}
