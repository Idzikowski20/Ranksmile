import db from '../../database/database';
import { getArticleIdSql } from '../articleSql';

export interface ArticleSeoMeta {
  domain: string;
  language: string;
  targetKeyword: string;
  competitorDomains: string[];
}

const DEFAULTS: ArticleSeoMeta = { domain: '', language: 'pl', targetKeyword: '', competitorDomains: [] };

// Mirrors pages/api/articles/ai-visibility.ts (domainFromUrl / competitorDomainsFromCache).
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
         .map((item: any) => (item.url ? domainFromUrl(item.url) : ''))
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
      const [articleRows] = await db.query(
         `SELECT a.*, a.language, d.domain
          FROM articles a
          LEFT JOIN domain d ON d."ID" = a.domain_id
          WHERE a.${articleIdSql} = ?
          LIMIT 1`,
         { replacements: [articleId] },
      );
      const article = (articleRows as any[])[0];
      if (!article) return { ...DEFAULTS };

      const [competitorRows] = await db.query(
         `SELECT domain, url FROM article_competitors WHERE article_id = ?`,
         { replacements: [articleId] },
      );
      const storedCompetitorDomains = (competitorRows as any[])
         .map((row) => row.domain || domainFromUrl(row.url || ''))
         .filter(Boolean);
      const cachedCompetitorDomains = competitorDomainsFromCache(article.competitor_outlines_cache);
      const competitorDomains = Array.from(new Set([...storedCompetitorDomains, ...cachedCompetitorDomains]));

      return {
         domain: article.domain || '',
         language: article.language || 'pl',
         targetKeyword: article.target_keyword || article.title || '',
         competitorDomains,
      };
   } catch {
      return { ...DEFAULTS };
   }
}
