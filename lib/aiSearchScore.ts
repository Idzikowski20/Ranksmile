export type AiCitation = {
   prompt: string;
   answer?: string;
   cited_url?: string;
   cited_domain?: string;
   is_own_domain?: boolean;
   is_competitor?: boolean;
};

export type AiVisibilitySummary = {
   prompts_total: number;
   prompts_cited: number;
   competitor_citations: number;
   extractability_score: number;
   citations: AiCitation[];
};

export function computeAiSearchScore(summary?: AiVisibilitySummary | null): number {
   if (!summary || summary.prompts_total <= 0) return 0;

   const ownCitationRate = summary.prompts_cited / summary.prompts_total;
   const competitorPressure = Math.min(summary.competitor_citations / Math.max(summary.prompts_total, 1), 1);
   const extractability = Math.min(Math.max(summary.extractability_score, 0), 100) / 100;

   const citationScore = ownCitationRate * 45;
   const shareScore = Math.max(0, 1 - competitorPressure) * 25;
   const extractabilityScore = extractability * 30;

   return Math.round(citationScore + shareScore + extractabilityScore);
}
