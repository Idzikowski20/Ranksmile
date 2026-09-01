import db from '../database/database';
import { countOccurrences } from './contentScore';
import type { NlpTerm } from './contentScore';
import type { SerpCompetitor } from './types/sidecar';

/** Replace an article's stored SERP terms atomically. */
export async function replaceArticleTerms(
  articleId: number,
  terms: NlpTerm[],
  plainText: string,
): Promise<void> {
  const rows = terms.filter((t) => t.term);
  await db.transaction(async (transaction) => {
    await db.query('DELETE FROM article_terms WHERE article_id = ?', {
      replacements: [articleId],
      transaction,
    });
    if (!rows.length) return;

    const placeholders = rows.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)').join(', ');
    const replacements = rows.flatMap((t) => [
      articleId,
      t.term,
      'topic',
      'serp',
      countOccurrences(plainText, t.term),
      t.suggested_min ?? Math.max(1, Math.round((t.target_count || 1) * 0.7)),
      t.suggested_max ?? Math.max(1, Math.round((t.target_count || 1) * 1.5)),
      t.target_count || 1,
    ]);

    await db.query(
      `INSERT INTO article_terms (article_id, term, term_type, source, current_count, target_min, target_max, importance, created_at) VALUES ${placeholders}`,
      { replacements, transaction },
    );
  });
}

/** Replace an article's stored SERP competitors atomically. */
export async function replaceCompetitors(articleId: number, competitors: SerpCompetitor[]): Promise<void> {
  const rows = (competitors || []).slice(0, 50);
  await db.transaction(async (transaction) => {
    await db.query('DELETE FROM article_competitors WHERE article_id = ?', {
      replacements: [articleId],
      transaction,
    });
    if (!rows.length) return;

    const placeholders = rows.map(() => '(?, ?, ?, ?, ?, CURRENT_TIMESTAMP)').join(', ');
    const replacements = rows.flatMap((c) => [articleId, c.url || '', c.domain || '', c.title || '', c.snippet || '']);

    await db.query(
      `INSERT INTO article_competitors (article_id, url, domain, title, snippet, created_at) VALUES ${placeholders}`,
      { replacements, transaction },
    );
  });
}
