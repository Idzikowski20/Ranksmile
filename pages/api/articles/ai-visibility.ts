import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../database/database';
import verifyUser from '../../../utils/verifyUser';
import { ensureArticlesTables } from '../../../lib/ensureArticlesTables';
import { computeOverallContentScore } from '../../../lib/aiSearchScore';
import { persistAiVisibilityRun } from '../../../lib/aiVisibilityStore';
import { getArticleIdSql } from '../../../lib/articleSql';
import { getCurrentUserId } from '../../../utils/getUser';
import { assertArticleAccess } from '../../../lib/tenancy';
import { getErrorMessage } from '../../../lib/errors';
import { langForCountry } from '../../../lib/countryLang';
import { queryOne, queryRows, ArticleRow } from '../../../lib/db/query';
import { runArticleAiPipeline } from '../../../lib/articleAiPipeline';
import { buildCompetitorBenchmarks } from '../../../lib/competitorAuditScore';
import { computeContentScore } from '../../../lib/contentScore';

function domainFromUrl(url: string): string {
   try {
      return new URL(url).hostname.replace(/^www\./, '');
   } catch {
      return '';
   }
}

function plainArticleText(article: ArticleRow): string {
   const html = article.content || '';
   const plain = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
   return `${article.meta_title || ''}\n${article.meta_description || ''}\n${plain}`.trim();
}

// Vercel: LLM/sidecar calls can take up to ~minutes; raise from the ~10s default.
export const config = { maxDuration: 60 };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   await db.sync();
   await ensureArticlesTables();
   const authorized = await verifyUser(req, res);
   if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
   if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

   const { articleId } = req.body;
   if (!articleId) return res.status(400).json({ error: 'articleId is required' });

   const userId = await getCurrentUserId(req, res);
   if (!(await assertArticleAccess(userId, Number(articleId)))) {
      return res.status(403).json({ error: 'Access denied.' });
   }

   try {
      const articleIdSql = await getArticleIdSql();
      const article = await queryOne<ArticleRow & { domain: string | null; country?: string | null; url?: string | null }>(
         `SELECT a.*, d.domain
          FROM articles a
          LEFT JOIN domain d ON d."ID" = a.domain_id
          WHERE a.${articleIdSql} = ?
          LIMIT 1`,
         [articleId],
      );
      if (!article) return res.status(404).json({ error: 'Article not found' });

      const competitorRows = await queryRows<{ domain: string | null; url: string | null }>(
         `SELECT domain, url FROM article_competitors WHERE article_id = ?`,
         [articleId],
      );

      const keyword = article.target_keyword || article.title || '';
      const plainText = plainArticleText(article);
      const ownDomain = (article.domain || '').replace(/^www\./, '');
      const country = (article as { country?: string }).country || 'US';
      const pageUrl = article.url || '';

      let corpusTexts: string[] = [];
      if (competitorRows.length && pageUrl) {
         try {
            const benchmarks = await buildCompetitorBenchmarks(
               keyword,
               pageUrl,
               competitorRows.map((r) => ({ url: r.url || undefined, domain: r.domain || undefined })),
               [],
            );
            corpusTexts = benchmarks?.corpusTexts ?? [];
         } catch {
            corpusTexts = [];
         }
      }

      const pipelineResult = await runArticleAiPipeline({
         keyword,
         articleText: plainText,
         corpusTexts,
         country,
         languageCode: langForCountry(country),
         ownDomain,
      });

      const summary = pipelineResult.summary;
      const aiScore = pipelineResult.aiScore;

      if (summary?.citations?.length) {
         await persistAiVisibilityRun(articleId, keyword, summary, aiScore);
      }

      let scoreData: import('../../../lib/contentScore').ScoreData | null = null;
      try {
         scoreData = article.score_data ? JSON.parse(article.score_data) : null;
      } catch { scoreData = null; }

      const html = article.content || '';
      const wc = plainText ? plainText.split(/\s+/).length : 0;
      const hc = (html.match(/<h[1-6]/gi) || []).length;
      const pc = (html.match(/<p[\s>]/gi) || []).length;
      const seoScore = scoreData?.seo_score ?? (scoreData
         ? computeContentScore(plainText, wc, hc, scoreData, pc, undefined, html, keyword)
         : 0);
      const contentScore = computeOverallContentScore(seoScore, aiScore);

      if (scoreData) {
         scoreData.seo_score = seoScore;
         scoreData.ai_score = aiScore;
         scoreData._content_score = contentScore;
         scoreData._computed_score = contentScore;
         await db.query(
            `UPDATE articles SET score_data = ?, content_score = ? WHERE ${articleIdSql} = ?`,
            { replacements: [JSON.stringify(scoreData), contentScore, articleId] },
         );
      }

      const competitorDomains = competitorRows
         .map((row) => row.domain || domainFromUrl(row.url || ''))
         .filter(Boolean);

      return res.status(200).json({
         summary: summary ? { ...summary, score: aiScore } : null,
         factsCount: pipelineResult.facts.length,
         seoScore,
         contentScore,
         source: pipelineResult.facts.length ? 'facts-pipeline' : 'paa-fallback',
         competitorDomains,
         warning: !summary?.citations?.length ? 'No AI visibility citations returned' : null,
      });
   } catch (error) {
      return res.status(500).json({ error: getErrorMessage(error) || 'AI visibility failed' });
   }
}
