/**
 * Organic-competitor domain entity. One per (domain_id, keyword) SERP peer,
 * surfaced in the shared modal used by the Audit tool + Content Editor. The DB
 * row shape + mapper live in src/infrastructure/competitors/competitorRow.ts.
 */
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
