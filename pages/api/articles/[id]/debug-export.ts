// GET /api/articles/[id]/debug-export  (DEV ONLY)
// Dumps everything we hold for an article — content, scores + per-slot breakdown,
// targets vs. actuals, NLP terms, competitors, ranking sources, the raw deep-analysis
// job result and AI-visibility — as one JSON, for comparing our scoring against Surfer.
import type { NextApiRequest, NextApiResponse } from 'next';
import { QueryTypes } from 'sequelize';
import db from '../../../../database/database';
import verifyUser from '../../../../utils/verifyUser';
import { ensureArticlesTables } from '../../../../lib/ensureArticlesTables';
import { getArticleIdSql } from '../../../../lib/articleSql';
import { ScoreData, computeContentScore, computeContentScoreBreakdown, updateTermsCoverage } from '../../../../lib/contentScore';
import { getCurrentUserId } from '../../../../utils/getUser';
import { assertArticleAccess } from '../../../../lib/tenancy';
import { getErrorMessage } from '../../../../lib/errors';
import { queryRows, queryOne } from '../../../../lib/db/query';
import type { ArticleRow } from '../../../../lib/db/query';

const parse = (v: any) => { try { return typeof v === 'string' ? JSON.parse(v) : v; } catch { return v; } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   if (process.env.NODE_ENV === 'production') return res.status(404).json({ error: 'Not found' });
   const authorized = await verifyUser(req, res);
   if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
   await ensureArticlesTables();

   const { id } = req.query;

   const userId = await getCurrentUserId(req, res);
   const articleId = parseInt((req.query.id ?? req.query.articleId) as string, 10);
   if (!(await assertArticleAccess(userId, articleId))) {
      return res.status(403).json({ error: 'Access denied.' });
   }
   const articleIdSql = await getArticleIdSql();

   try {
      const article = await queryOne<ArticleRow>(`SELECT *, ${articleIdSql} AS id FROM articles WHERE ${articleIdSql} = ? LIMIT 1`, [id]);
      if (!article) return res.status(404).json({ error: 'Article not found' });

      const content: string = article.content || '';
      const plainText = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      const wordCount = plainText ? plainText.split(/\s+/).length : 0;
      const headingCount = (content.match(/<h[1-6]\b/gi) || []).length;
      const paragraphCount = (content.match(/<p\b/gi) || []).length;
      const internalLinks = (content.match(/<a\s[^>]*href=/gi) || []).length;
      const keyword: string = article.target_keyword || '';

      const sd: ScoreData = parse(article.score_data) || ({} as ScoreData);
      if (Array.isArray(sd.terms)) sd.terms = updateTermsCoverage(plainText, sd.terms);

      const score = computeContentScore(plainText, wordCount, headingCount, sd, paragraphCount, internalLinks, content, keyword);
      const breakdown = computeContentScoreBreakdown(plainText, wordCount, headingCount, sd, paragraphCount, content, keyword);

      const competitors = await queryRows<Record<string, unknown>>('SELECT * FROM article_competitors WHERE article_id = ? ORDER BY id ASC', [id]);
      const job = await queryOne<{ payload: string | null; result: string | null; status: string | null; created_at: string | null }>('SELECT payload, result, status, created_at FROM analysis_jobs WHERE article_id = ? ORDER BY created_at DESC, id DESC LIMIT 1', [id]);
      const aiv = await queryOne<{ summary_json: string | null; score: number | null; created_at: string | null }>('SELECT summary_json, score, created_at FROM ai_visibility_runs WHERE article_id = ? ORDER BY created_at DESC, id DESC LIMIT 1', [id]);

      const range = (actual: number, target: any, min: any, max: any) => ({ actual, target: target ?? null, min: min ?? null, max: max ?? null });

      const out = {
         generatedAt: new Date().toISOString(),
         article: {
            id: article.id, title: article.title, target_keyword: keyword, language: article.language,
            status: article.status, content_score: article.content_score, ranking_score: article.ranking_score,
         },
         counts: {
            words: range(wordCount, sd.words_target, sd.words_min, sd.words_max),
            headings: range(headingCount, sd.headings_target, sd.headings_min, sd.headings_max),
            paragraphs: range(paragraphCount, sd.paragraphs_target, sd.paragraphs_min, sd.paragraphs_max),
            internal_links: internalLinks,
            competitor_count: sd.competitor_count ?? competitors.length,
         },
         score: {
            our_computed_score: score,
            stored_content_score: article.content_score,
            ai_visibility_score: aiv?.score ?? null,
            breakdown: breakdown.slots,
            total_possible: breakdown.totalPossible,
         },
         terms: sd.terms || [],
         ranking_sources: parse(article.ranking_sources),
         competitors,
         deep_analysis_job: job ? { status: job.status, payload: parse(job.payload), result: parse(job.result) } : null,
         ai_visibility: aiv ? { score: aiv.score, summary: parse(aiv.summary_json) } : null,
         content_html: content,
      };

      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="article-${id}-debug.json"`);
      return res.status(200).send(JSON.stringify(out, null, 2));
   } catch (error) {
      return res.status(500).json({ error: getErrorMessage(error) || 'DB error' });
   }
}
