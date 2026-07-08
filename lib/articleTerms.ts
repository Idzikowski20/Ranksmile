import db from '../database/database';
import { CoverageItem, CoverageSource, hashId } from './aiCoverage';

export { isUsefulTerm, normalizeTerm, dedupeUsefulTerms } from './termUtils';

export type ArticleTerm = {
   term: string;
   target_count: number;
   current_count?: number;
   term_type?: 'keyword' | 'topic' | 'entity' | 'question';
};

/** A row from the `article_terms` DB table (lib/ensureArticlesTables.ts:106-118). */
export interface ArticleTermRow {
   term: string;
   term_type: 'keyword' | 'topic' | 'entity' | 'question';
   source: CoverageSource;
   importance: number;          // 0..1
   target_min: number;
   target_max: number;
   current_count: number;
}

function importanceBucket(n: number): CoverageItem['importance'] {
   if (n >= 0.8) return 'critical';
   if (n >= 0.4) return 'recommended';
   return 'optional';
}

function quality(currentCount: number, targetMax: number): number {
   if (targetMax <= 0) return 0;
   return Math.min(5, Math.round((currentCount / targetMax) * 5));
}

/** Map article_terms rows to CoverageItems. term_type='question' → type:'fact'; else 'entity'.
 *  `importance` on the DB row is a raw target_count integer (>=1), not the 0..1 scale
 *  `importanceBucket` expects — normalize relative to the batch max before bucketing. */
export function articleTermsToCoverageItems(rows: ArticleTermRow[]): CoverageItem[] {
   const maxImp = Math.max(0, ...rows.map((r) => r.importance ?? 0));
   return rows.map((r) => {
      const isFact = r.term_type === 'question';
      const covered = r.current_count >= r.target_min;
      const normalizedImportance = maxImp > 0 ? (r.importance ?? 0) / maxImp : 0;
      return {
         id: `${isFact ? 'fact' : 'entity'}-${hashId(r.term)}`,
         label: r.term,
         type: isFact ? 'fact' : 'entity',
         category: 'knowledge' as const,
         importance: importanceBucket(normalizedImportance),
         source: r.source ?? 'serp',
         covered,
         quality: covered ? 5 : quality(r.current_count, r.target_max),
      };
   });
}

/** Fetch article_terms rows for one article. Returns [] on no rows. */
export async function readArticleTerms(articleId: number): Promise<ArticleTermRow[]> {
   const [rows] = await db.query(
      'SELECT term, term_type, source, importance, target_min, target_max, current_count FROM article_terms WHERE article_id = ?',
      { replacements: [articleId] },
   ) as [ArticleTermRow[], unknown];
   return rows;
}
