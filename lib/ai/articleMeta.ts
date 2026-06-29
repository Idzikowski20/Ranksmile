import db from '../../database/database';
import { getArticleIdSql } from '../articleSql';

export interface ArticleSeoMeta {
  domain: string;
  language: string;
  targetKeyword: string;
  competitorDomains: string[];
  // Persisted scores shown in the editor's Content Score panel — so Surfy reports the SAME numbers
  // as the UI (rather than re-computing different ones) until the article is actually edited.
  rankingScore: number | null;
  rankingSignals: any | null;
  aiVisibility: any | null;
}

const DEFAULTS: ArticleSeoMeta = { domain: '', language: 'pl', targetKeyword: '', competitorDomains: [], rankingScore: null, rankingSignals: null, aiVisibility: null };

const parseJsonish = (v: any): any | null => {
  if (v == null) return null;
  if (typeof v === 'object') return v;
  try { return JSON.parse(v); } catch { return null; }
};

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
         rankingScore: article.ranking_score != null ? Number(article.ranking_score) : null,
         rankingSignals: parseJsonish(article.ranking_signals),
         aiVisibility: parseJsonish(article.ai_visibility_summary),
      };
   } catch {
      return { ...DEFAULTS };
   }
}
