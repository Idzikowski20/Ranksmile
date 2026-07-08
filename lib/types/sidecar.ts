import type { NlpTerm } from '../contentScore';
import type { AiVisibilitySummary } from '../aiSearchScore';

export type SerpCompetitor = {
   url: string;
   domain: string;
   title: string;
   snippet: string;
   word_count?: number;
   heading_count?: number;
   serp_position?: number;
};

export type SerpAnalysis = {
   terms?: NlpTerm[];
   paa_questions?: string[];
   competitors?: SerpCompetitor[];
   words_min?: number;
   words_max?: number;
   words_target?: number;
   headings_min?: number;
   headings_max?: number;
   headings_target?: number;
   paragraphs_min?: number;
   paragraphs_max?: number;
   paragraphs_target?: number;
   _competitor_texts?: string[];
};

export type FetchPageResult = {
   html?: string;
   title?: string;
   meta_title?: string;
   meta_description?: string;
   heading_count?: number;
   paragraph_count?: number;
   images_without_alt?: number;
   featured_image?: string;
   ttfb_ms?: number;
   ttfbMs?: number;
   load_ms?: number;
   loadMs?: number;
};

export type DeepAnalysisPipelineResult = {
   scrape_serp?: SerpAnalysis;
   fetch_page?: FetchPageResult;
   ai_search?: AiVisibilitySummary;
   ranking_score?: number;
   ranking_signals?: Record<string, unknown>;
   classify?: { word_count_estimate?: number };
};

export type RankingSourceEntry = { rank: number; domain: string; url: string; title: string };

/** Python sidecar `/generate` response shape (partial — fields vary by pipeline). */
export type GenerateSidecarResponse = {
   article_html?: string;
   meta_title?: string;
   meta_description?: string;
   meta_url?: string;
   schema_json?: Record<string, unknown>;
   article_schema?: Record<string, unknown>;
   score_data?: Record<string, unknown>;
   internal_links?: unknown[];
};
