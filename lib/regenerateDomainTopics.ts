import { QueryTypes, type Transaction } from 'sequelize';
import db from '../database/database';
import { queryOne, queryRows } from './db/query';
import { getDomainLocale } from './domainLanguage';
import { clusterKeywords, type EnrichedKeyword } from './topicClustering';

export type DomainTopicRow = { id: number; title: string; summary: string | null };

/** Re-cluster domain_keywords into domain_topics using the domain's configured language. */
export async function regenerateDomainTopics(domainId: number): Promise<DomainTopicRow[]> {
  const locale = await getDomainLocale(domainId);
  const domain = await queryOne<{ domain: string }>(
    'SELECT domain FROM domain WHERE "ID" = ? LIMIT 1',
    [domainId],
  );
  if (!domain?.domain) throw new Error('Domain not found');

  const kwRows = await queryRows<{ keyword: string }>(
    'SELECT keyword FROM domain_keywords WHERE domain_id = ? ORDER BY COALESCE(volume, 0) DESC, id LIMIT 80',
    [domainId],
  );
  if (!kwRows.length) throw new Error('Brak słów kluczowych — uruchom setup domeny.');

  const enriched: EnrichedKeyword[] = kwRows.map((k) => ({
    keyword: k.keyword,
    volume: null,
    kd: null,
    position: null,
  }));

  const clusters = await clusterKeywords(domain.domain, enriched, locale.languageCode);
  const topics = clusters.slice(0, 8).map((c) => ({
    title: c.title.trim(),
    summary: (c.summary || '').trim(),
  })).filter((t) => t.title.length > 0);

  if (!topics.length) throw new Error('Nie udało się wygenerować tematów.');

  await db.transaction(async (tx: Transaction) => {
    const q = (sql: string, repl: unknown[]) => db.query(sql, { replacements: repl, transaction: tx });
    await q('DELETE FROM domain_topics WHERE domain_id = ?', [domainId]);
    for (const t of topics) {
      await q(
        'INSERT INTO domain_topics (domain_id, title, summary, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)',
        [domainId, t.title, t.summary],
      );
    }
  });

  const saved = await db.query<DomainTopicRow>(
    'SELECT id, title, summary FROM domain_topics WHERE domain_id = ? ORDER BY id',
    { replacements: [domainId], type: QueryTypes.SELECT },
  );
  return saved;
}
