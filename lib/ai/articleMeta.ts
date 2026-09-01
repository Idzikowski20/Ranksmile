import { getArticleIdSql } from '../articleSql';
import { queryOne, queryRows, type ArticleRow } from '../db/query';
import type { AiVisibilitySummary } from '../aiSearchScore';
import { parseJsonish } from '../types/json';
import { getDomainLocale } from '../domainLanguage';

export interface ArticleSeoMeta {
  domain: string;
  language: string;
  targetKeyword: string;
  competitorDomains: string[];
  rankingScore: number | null;
  rankingSignals: Record<string, unknown> | null;
  aiVisibility: AiVisibilitySummary | null;
}

const DEFAULTS: ArticleSeoMeta = { domain: '', language: 'pl', targetKeyword: '', competitorDomains: [], rankingScore: null, rankingSignals: null, aiVisibility: null };

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
      const parsed = JSON.parse(cache) as { competitors?: Array<{ url?: string }> };
      return (parsed.competitors || [])
         .map((item) => (item.url ? domainFromUrl(item.url) : ''))
         .filter(Boolean);
   } catch {
      return [];
   }
}

/**
 * Resolve an article's SEO metadata (own domain, language, target keyword, competitor domains)
 * from the DB. Extracted from pages/api/articles/ai-visibility.ts and plagiarism.ts.
 * Never throws: returns safe defaults when the article is missing or any DB error occurs.
 */
export async function resolveArticleSeoMeta(articleId: number): Promise<ArticleSeoMeta> {
   try {
      const articleIdSql = await getArticleIdSql();
      const article = await queryOne<ArticleRow & { domain: string | null; ai_visibility_summary: string | null; domain_id: number | null }>(
         `SELECT a.*, a.language, a.domain_id, d.domain
          FROM articles a
          LEFT JOIN domain d ON d."ID" = a.domain_id
          WHERE a.${articleIdSql} = ?
          LIMIT 1`,
         [articleId],
      );
      if (!article) return { ...DEFAULTS };

      const competitorRows = await queryRows<{ domain: string | null; url: string | null }>(
         `SELECT domain, url FROM article_competitors WHERE article_id = ?`,
         [articleId],
      );
      const storedCompetitorDomains = competitorRows
         .map((row) => row.domain || domainFromUrl(row.url || ''))
         .filter(Boolean);
      const cachedCompetitorDomains = competitorDomainsFromCache(article.competitor_outlines_cache);
      const competitorDomains = Array.from(new Set([...storedCompetitorDomains, ...cachedCompetitorDomains]));

      const domainLocale = article.domain_id ? await getDomainLocale(article.domain_id) : null;

      return {
         domain: article.domain || '',
         language: article.language || domainLocale?.languageCode || 'pl',
         targetKeyword: article.target_keyword || article.title || '',
         competitorDomains,
         rankingScore: article.ranking_score != null ? Number(article.ranking_score) : null,
         rankingSignals: parseJsonish<Record<string, unknown>>(article.ranking_signals),
         aiVisibility: parseJsonish<AiVisibilitySummary>(article.ai_visibility_summary),
      };
   } catch {
      return { ...DEFAULTS };
   }
}
