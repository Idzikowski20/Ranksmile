import { safeJsonParse } from '../safeJson';
import type { CompetitorDocument } from './types';

type OutlineHeading = { level?: number; text?: string };
type OutlineRow = {
  url?: string;
  title?: string;
  serp_title?: string;
  word_count?: number;
  heading_count?: number;
  serp_position?: number;
  headings?: OutlineHeading[];
  authority?: number;
  score?: number;
};

export function headingTextsFromOutline(headings: OutlineHeading[] | undefined): string[] {
  if (!Array.isArray(headings)) return [];
  return headings
    .filter((h) => (h.level ?? 2) === 2 && typeof h.text === 'string' && h.text.trim().length > 1)
    .map((h) => String(h.text).trim());
}

export function buildCompetitorDocuments(opts: {
  outlinesCache?: string | null;
  scoreData?: Record<string, unknown> | null;
}): CompetitorDocument[] {
  const parsed = safeJsonParse<{ competitors?: OutlineRow[] } | OutlineRow[]>(
    opts.outlinesCache ?? null,
    [],
  );
  const list: OutlineRow[] = Array.isArray(parsed)
    ? parsed
    : (parsed && typeof parsed === 'object' && Array.isArray((parsed as { competitors?: OutlineRow[] }).competitors)
      ? (parsed as { competitors: OutlineRow[] }).competitors
      : []);

  const scoreComps = Array.isArray(opts.scoreData?.competitors)
    ? (opts.scoreData!.competitors as Array<Record<string, unknown>>)
    : [];

  return list
    .map((row, i) => {
      const url = row.url || '';
      if (!url) return null;
      const scoreHit = scoreComps.find((c) => c.url === url) || scoreComps[i];
      const authorityRaw = row.authority ?? (typeof scoreHit?.authority === 'number' ? scoreHit.authority : null);
      const scoreRaw = row.score ?? (typeof scoreHit?.score === 'number' ? scoreHit.score : null);
      const doc: CompetitorDocument = {
        url,
        title: row.title || row.serp_title || url,
        score: typeof scoreRaw === 'number' ? scoreRaw : Math.max(0, 100 - i * 8),
        authority: typeof authorityRaw === 'number' ? authorityRaw : Math.max(0.2, 1 - i * 0.08),
        headings: headingTextsFromOutline(row.headings),
        entities: [],
        claimIds: [],
        topicBlockIds: [],
        serpPosition: row.serp_position ?? i + 1,
      };
      return doc;
    })
    .filter((x): x is CompetitorDocument => Boolean(x));
}
