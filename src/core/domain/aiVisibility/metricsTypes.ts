import type { LlmCitation } from './citation';

export type BrandMention = { brand: string, domain: string, sentiment: 'positive' | 'neutral' | 'negative' | 'mixed', pos: number, quotes: string[] };

export type ResultRow = {
   promptId: number,
   model: string,
   ownCited: boolean,
   ownPosition: number | null,
   citations: LlmCitation[],
   topic: string,
   text: string,
   brands: BrandMention[],
   /** false = the brands column is still NULL (extraction has not reached this answer),
    *  so an empty `brands` here means "unknown", not "no brands named". */
   brandsAnalyzed?: boolean,
   fanOutQueries?: string[],
};

export type SourceBrand = { brand: string, domain: string };
export type SourceDetailBrand = { pos: number, brand: string, sentiment: BrandMention['sentiment'], quotes: string[] };
export type GapCard = { brand: string, gap: number, shared: number, you: number };
