// Shared "Organic Competitors" model. One store keyed by (domain_id, keyword), scanned
// via the sidecar /competitor-outlines (top-10 SERP with word/heading counts + positions)
// + DataForSEO domain rank for Authority. Surfaced in a shared modal used by BOTH the
// Audit tool and the Content Editor; the user toggles which competitors count.

export interface CompetitorDTO {
   id: number;
   keyword: string;
   position: number; // SERP rank (1..10)
   url: string;
   domain: string;
   title: string;
   snippet: string;
   wordCount: number;
   headingCount: number;
   seoScore: number; // 0-100, relative to the peer set (word/heading median)
   authority: number | null; // 0-100 DataForSEO domain rank, null when unavailable
   selected: boolean; // counts toward the audit charts / editor targets
}

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
