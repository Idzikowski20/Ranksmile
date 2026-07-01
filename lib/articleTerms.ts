import db from '../database/database';
import { CoverageItem, CoverageSource, hashId } from './aiCoverage';

const POLISH_STOPWORDS = new Set([
   'aby', 'acz', 'aczkolwiek', 'ale', 'albo', 'ani', 'az', 'bardziej', 'bardzo',
   'bez', 'bo', 'bowiem', 'by', 'byc', 'byl', 'byla', 'bylo', 'byly', 'beda',
   'bedzie', 'cala', 'cali', 'caly', 'ci', 'cie', 'ciebie', 'co', 'czy', 'dla',
   'do', 'gdy', 'gdyz', 'gdzie', 'go', 'ich', 'im', 'inna', 'inne', 'inny',
   'jest', 'jestem', 'jesli', 'juz', 'kazdy', 'kiedy', 'kto', 'ktora', 'ktore',
   'ktory', 'ku', 'lub', 'ma', 'maja', 'mam', 'mial', 'miec', 'mnie', 'moze',
   'mozna', 'na', 'nad', 'nam', 'nas', 'nasi', 'nasz', 'nasza', 'nasze', 'nic',
   'nich', 'nie', 'nim', 'niz', 'oraz', 'pan', 'pani', 'po', 'pod', 'poniewaz',
   'przed', 'przez', 'przy', 'sa', 'sie', 'sobie', 'sposob', 'ta', 'tak',
   'takze', 'tam', 'te', 'tego', 'tej', 'ten', 'teraz', 'tez', 'to', 'toba',
   'tobie', 'trzeba', 'tu', 'tych', 'tylko', 'tym', 'u', 'was', 'we', 'wedlug',
   'wiele', 'wlasnie', 'wszystko', 'wtedy', 'z', 'za', 'zaden', 'ze', 'zeby',
]);

const ENGLISH_STOPWORDS = new Set([
   'the', 'and', 'for', 'with', 'that', 'this', 'from', 'are', 'was', 'were',
   'has', 'have', 'had', 'not', 'you', 'your', 'can', 'will', 'would', 'could',
   'should', 'about', 'into', 'than', 'then', 'when', 'where', 'what', 'how',
]);

const GENERIC_WORDS = new Set([
   'artykul', 'strona', 'tekst', 'temat', 'informacje', 'warto', 'mozna',
   'nalezy', 'czas', 'czasem', 'sytuacja', 'sytuacji', 'ktos', 'cos',
]);

export type ArticleTerm = {
   term: string;
   target_count: number;
   current_count?: number;
   term_type?: 'keyword' | 'topic' | 'entity' | 'question';
};

export function normalizeTerm(term: string): string {
   return term
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
}

function isStopword(token: string): boolean {
   return POLISH_STOPWORDS.has(token) || ENGLISH_STOPWORDS.has(token) || GENERIC_WORDS.has(token);
}

export function isUsefulTerm(term: string): boolean {
   const normalized = normalizeTerm(term);
   if (normalized.length < 4) return false;
   if (/^\d+$/.test(normalized)) return false;

   const tokens = normalized.split(' ').filter(Boolean);
   if (!tokens.length) return false;
   if (tokens.every(isStopword)) return false;
   if (tokens.length === 1) {
      if (isStopword(tokens[0])) return false;
      if (tokens[0].length < 5) return false;
   }

   const meaningfulTokens = tokens.filter((token) => !isStopword(token));
   return meaningfulTokens.length > 0;
}

export function dedupeUsefulTerms<T extends ArticleTerm>(terms: T[]): T[] {
   const seen = new Set<string>();
   const result: T[] = [];

   for (const term of terms) {
      const key = normalizeTerm(term.term);
      if (!isUsefulTerm(key) || seen.has(key)) continue;
      seen.add(key);
      result.push({ ...term, term: key });
   }

   return result;
}

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
