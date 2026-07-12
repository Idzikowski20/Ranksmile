import type { LlmCitation } from './dataforseoLlm';

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
   fanOutQueries?: string[],
};

export type SourceBrand = { brand: string, domain: string };
export type SourceDetailBrand = { pos: number, brand: string, sentiment: BrandMention['sentiment'], quotes: string[] };
export type GapCard = { brand: string, gap: number, shared: number, you: number };
