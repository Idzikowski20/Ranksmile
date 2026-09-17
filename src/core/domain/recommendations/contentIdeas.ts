import { kwScore, type GscKeywordRow } from '@/utils/gsc';

export type GscKeywordStat = { keyword: string; impressions: number; position: number; clicks: number };
export type ContentIdeaRec = { title: string | null; type: string | null; search_volume?: number | null };
export type ContentIdea = GscKeywordStat & { volume: number | null };

/** GSC keyword rows (one per page) → one per keyword, the best-scoring row kept, best first. */
export function dedupeGscKeywords(rows: GscKeywordRow[]): GscKeywordStat[] {
  const seen = new Map<string, GscKeywordStat>();
  for (const row of rows) {
    if (!row.keyword) continue;
    const key = row.keyword.toLowerCase();
    const candidate = {
      keyword: row.keyword, position: row.position ?? 0, clicks: row.clicks ?? 0, impressions: row.impressions ?? 0,
    };
    const existing = seen.get(key);
    if (!existing || byScore(candidate, existing) < 0) seen.set(key, candidate);
  }
  return Array.from(seen.values()).sort(byScore);
}

/** Best score first; ties by keyword so the result never depends on row order. */
function byScore(a: GscKeywordStat, b: GscKeywordStat): number {
  const d = kwScore(b) - kwScore(a);
  if (d !== 0) return d;
  if (a.keyword === b.keyword) return 0;
  return a.keyword < b.keyword ? -1 : 1;
}

/**
 * The Recommendations "Content ideas" list: scan-suggested topics (`create`
 * recommendations) first, then GSC keywords with more than 20 impressions — both minus
 * anything an existing article already covers (by keyword or title), without duplicates.
 * Shared by the Recommendations page and the Automations scheduling dialog.
 */
export function buildContentIdeas(opts: {
  recs?: ContentIdeaRec[];
  gscKeywords: GscKeywordStat[];
  covered: Iterable<string | null | undefined>;
  limit?: number;
}): ContentIdea[] {
  const covered = new Set<string>();
  for (const c of opts.covered) {
    const k = (c || '').trim().toLowerCase();
    if (k) covered.add(k);
  }
  const seen = new Set<string>();
  const out: ContentIdea[] = [];
  const push = (idea: ContentIdea) => {
    const k = idea.keyword.toLowerCase();
    if (covered.has(k) || seen.has(k)) return;
    seen.add(k);
    out.push(idea);
  };
  for (const r of opts.recs || []) {
    const keyword = (r.title || '').trim();
    // No GSC history by definition — these are topics nobody has ranked for yet.
    if (r.type === 'create' && keyword) {
      push({ keyword, impressions: 0, position: 0, clicks: 0, volume: r.search_volume ?? null });
    }
  }
  for (const kw of opts.gscKeywords) {
    if (kw.impressions > 20) push({ ...kw, volume: null });
  }
  return out.slice(0, opts.limit ?? 150);
}
