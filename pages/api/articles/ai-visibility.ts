import type { NextApiRequest, NextApiResponse } from 'next';
import { QueryTypes } from 'sequelize';
import db from '../../../database/database';
import verifyUser from '../../../utils/verifyUser';
import { ensureArticlesTables } from '../../../lib/ensureArticlesTables';
import { computeAiSearchScore, AiVisibilitySummary } from '../../../lib/aiSearchScore';
import { getArticleIdSql } from '../../../lib/articleSql';

function domainFromUrl(url: string): string {
   try {
      return new URL(url).hostname.replace(/^www\./, '');
   } catch {
      return '';
   }
}

function competitorDomainsFromCache(cache: string | null): string[] {
   if (!cache) return [];
   try {
      const parsed = JSON.parse(cache);
      return (parsed.competitors || [])
         .map((item: any) => item.url ? domainFromUrl(item.url) : '')
         .filter(Boolean);
   } catch {
      return [];
   }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   await db.sync();
   await ensureArticlesTables();
   const authorized = await verifyUser(req, res);
   if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
   if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

   const { articleId } = req.body;
   if (!articleId) return res.status(400).json({ error: 'articleId is required' });

   try {
      const articleIdSql = await getArticleIdSql();
      const [articleRows] = await db.query(
         `SELECT a.*, d.domain
          FROM articles a
          LEFT JOIN domain d ON d."ID" = a.domain_id
          WHERE a.${articleIdSql} = ?
          LIMIT 1`,
         { replacements: [articleId] },
      );
      const article = (articleRows as any[])[0];
      if (!article) return res.status(404).json({ error: 'Article not found' });

      const [competitorRows] = await db.query(
         `SELECT domain, url FROM article_competitors WHERE article_id = ?`,
         { replacements: [articleId] },
      );
      const storedCompetitorDomains = (competitorRows as any[])
         .map((row) => row.domain || domainFromUrl(row.url || ''))
         .filter(Boolean);
      const cachedCompetitorDomains = competitorDomainsFromCache(article.competitor_outlines_cache);
      const competitorDomains = Array.from(new Set([...storedCompetitorDomains, ...cachedCompetitorDomains]));

      const sidecarUrl = (process.env.PYTHON_SIDECAR_URL || 'http://127.0.0.1:8001').replace('localhost', '127.0.0.1');
      const sidecarRes = await fetch(`${sidecarUrl}/ai-visibility`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
            keyword: article.target_keyword || article.title,
            own_domain: article.domain || '',
            competitor_domains: competitorDomains,
            article_content: `${article.meta_title || ''}\n${article.meta_description || ''}\n${article.content || ''}`,
         }),
         signal: AbortSignal.timeout ? AbortSignal.timeout(60000) : undefined,
      } as RequestInit);

      if (!sidecarRes.ok) {
         const err = await sidecarRes.text();
         throw new Error(err || 'AI visibility sidecar failed');
      }

      const sidecarData = await sidecarRes.json();
      const summary: AiVisibilitySummary = {
         prompts_total: sidecarData.prompts_total || 0,
         prompts_cited: sidecarData.prompts_cited || 0,
         competitor_citations: sidecarData.competitor_citations || 0,
         extractability_score: sidecarData.extractability_score || 0,
         citations: sidecarData.citations || [],
      };
      const score = computeAiSearchScore(summary);

      let runId: number | undefined;
      if (process.env.DATABASE_URL) {
         const rows = await db.query<{ id: number }>(
            `INSERT INTO ai_visibility_runs
               (article_id, target_keyword, score, prompts_total, prompts_cited, competitor_citations, summary_json, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
             RETURNING id`,
            {
               replacements: [
                  articleId,
                  article.target_keyword || article.title || '',
                  score,
                  summary.prompts_total,
                  summary.prompts_cited,
                  summary.competitor_citations,
                  JSON.stringify(summary),
               ],
               type: QueryTypes.SELECT,
            },
         );
         runId = rows[0]?.id;
      } else {
         const [insertedRunId] = await db.query(
            `INSERT INTO ai_visibility_runs
               (article_id, target_keyword, score, prompts_total, prompts_cited, competitor_citations, summary_json, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
            {
               replacements: [
                  articleId,
                  article.target_keyword || article.title || '',
                  score,
                  summary.prompts_total,
                  summary.prompts_cited,
                  summary.competitor_citations,
                  JSON.stringify(summary),
               ],
               type: QueryTypes.INSERT,
            },
         );
         runId = insertedRunId as unknown as number;
      }
      if (!runId) throw new Error('Failed to resolve AI visibility run id');

      for (const citation of summary.citations) {
         await db.query(
            `INSERT INTO ai_visibility_citations
               (run_id, prompt, answer, cited_url, cited_domain, is_own_domain, is_competitor, sentiment, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
            {
               replacements: [
                  runId,
                  citation.prompt,
                  citation.answer || '',
                  citation.cited_url || '',
                  citation.cited_domain || '',
                  citation.is_own_domain ? 1 : 0,
                  citation.is_competitor ? 1 : 0,
                  '',
               ],
            },
         );
      }

      return res.status(200).json({ summary: { ...summary, score }, warning: sidecarData.warning || null });
   } catch (error: any) {
      return res.status(500).json({ error: error?.message || 'AI visibility failed' });
   }
}
