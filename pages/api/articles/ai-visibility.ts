import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../database/database';
import verifyUser from '../../../utils/verifyUser';
import { ensureArticlesTables } from '../../../lib/ensureArticlesTables';
import { computeAiSearchScore, AiVisibilitySummary } from '../../../lib/aiSearchScore';
import { persistAiVisibilityRun } from '../../../lib/aiVisibilityStore';
import { getArticleIdSql } from '../../../lib/articleSql';
import { callSidecar } from '../../../lib/sidecar';
import { getCurrentUserId } from '../../../utils/getUser';
import { assertArticleAccess } from '../../../lib/tenancy';
import { getErrorMessage } from '../../../lib/errors';
import { queryOne, queryRows, ArticleRow } from '../../../lib/db/query';
import { buildArticleContext } from '../../../lib/articleContext';

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
      const article = await queryOne<ArticleRow & { domain: string | null }>(
         `SELECT a.*, d.domain
          FROM articles a
          LEFT JOIN domain d ON d."ID" = a.domain_id
          WHERE a.${articleIdSql} = ?
          LIMIT 1`,
         [articleId],
      );
      if (!article) return res.status(404).json({ error: 'Article not found' });

      // article_competitors' `domain` column isn't guaranteed populated (defensive fallback to
      // domainFromUrl(url)); ArticleContext.competitors doesn't carry that fallback, so this one
      // read is kept as-is rather than sourced from ctx (would silently drop domains on old rows).
      const competitorRows = await queryRows<{ domain: string | null; url: string | null }>(
         `SELECT domain, url FROM article_competitors WHERE article_id = ?`,
         [articleId],
      );
      const storedCompetitorDomains = competitorRows
         .map((row) => row.domain || domainFromUrl(row.url || ''))
         .filter(Boolean);
      const cachedCompetitorDomains = competitorDomainsFromCache(article.competitor_outlines_cache);
      const competitorDomains = Array.from(new Set([...storedCompetitorDomains, ...cachedCompetitorDomains]));

      // ctx.keyword mirrors article.target_keyword (both '' when unset) — same OR-fallback result.
      const ctx = await buildArticleContext(Number(articleId));
      const keyword = ctx.keyword || article.title || '';

      const sidecarData = await callSidecar('/ai-visibility', {
         keyword,
         own_domain: article.domain || '',
         competitor_domains: competitorDomains,
         article_content: `${article.meta_title || ''}\n${article.meta_description || ''}\n${article.content || ''}`,
      });
      const summary: AiVisibilitySummary = {
         prompts_total: sidecarData.prompts_total || 0,
         prompts_cited: sidecarData.prompts_cited || 0,
         competitor_citations: sidecarData.competitor_citations || 0,
         extractability_score: sidecarData.extractability_score || 0,
         citations: sidecarData.citations || [],
      };
      const score = computeAiSearchScore(summary);
      await persistAiVisibilityRun(articleId, keyword, summary);

      return res.status(200).json({ summary: { ...summary, score }, warning: sidecarData.warning || null });
   } catch (error) {
      return res.status(500).json({ error: getErrorMessage(error) || 'AI visibility failed' });
   }
}
