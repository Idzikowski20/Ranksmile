import type { CompetitorDTO } from '../../core/domain/competitors/competitor';

/** Raw row of the domain_serp_competitors table (parse/camelCase at the boundary). */
export interface CompetitorRow {
  id: number;
  domain_id: number;
  keyword: string;
  position: number | null;
  url: string;
  domain: string | null;
  title: string | null;
  snippet: string | null;
  word_count: number | null;
  heading_count: number | null;
  seo_score: number | null;
  authority: number | null;
  selected: number | null;
  created_at: string | null;
}

export function rowToCompetitorDTO(r: CompetitorRow): CompetitorDTO {
  return {
    id: r.id,
    keyword: r.keyword,
    position: r.position ?? 0,
    url: r.url,
    domain: r.domain ?? '',
    title: r.title ?? '',
    snippet: r.snippet ?? '',
    wordCount: r.word_count ?? 0,
    headingCount: r.heading_count ?? 0,
    seoScore: r.seo_score ?? 0,
    authority: r.authority,
    selected: (r.selected ?? 1) === 1,
  };
}
