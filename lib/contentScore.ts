// Content Score formula — aspirational targets based on scraped competitor + NLP terms
// Weights: wordScore(30%) + headingScore(20%) + paragraphScore(15%) + termsScore(35%)
// Targets are set HIGHER than the source article (1.5x words, 2.5x headings/paragraphs)
// so a freshly imported article starts around 40-60 points, not 100.

export interface NlpTerm {
   term: string;
   target_count: number;
   current_count?: number;
}

export interface ScoreData {
   terms: NlpTerm[];
   words_target: number;
   words_min: number;
   words_max: number;
   headings_target: number;
   headings_min: number;
   headings_max: number;
   paragraphs_target?: number;
   paragraphs_min?: number;
   paragraphs_max?: number;
}

export function countOccurrences(text: string, term: string): number {
   if (!text || !term) return 0;
   const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
   const matches = text.match(new RegExp(escaped, 'gi'));
   return matches ? matches.length : 0;
}

export function computeContentScore(
   plainText: string,
   wordCount: number,
   headingCount: number,
   scoreData: ScoreData,
   paragraphCount?: number,
   internalLinksCount?: number,
): number {
   if (!scoreData || !scoreData.terms?.length) return 0;

   // 30% — word count vs aspirational target (capped at 1.0 — hitting target = full points)
   const wordScore = Math.min(wordCount / Math.max(scoreData.words_target, 1), 1) * 30;

   // 20% — heading count vs aspirational target
   const headingScore = Math.min(headingCount / Math.max(scoreData.headings_target, 1), 1) * 20;

   // 15% — paragraph count vs aspirational target (if data available, else folded into terms)
   let paraScore = 0;
   let termsWeight = 50;
   if (scoreData.paragraphs_target && paragraphCount !== undefined) {
      paraScore = Math.min(paragraphCount / Math.max(scoreData.paragraphs_target, 1), 1) * 15;
      termsWeight = 35;
   }

   // termsWeight% — partial NLP terms coverage: each term contributes proportionally
   // (actual/target capped at 1.0 per term, then averaged across all terms)
   const termsRatio = scoreData.terms.reduce((sum, t) => {
      const actual = countOccurrences(plainText, t.term);
      return sum + Math.min(actual / Math.max(t.target_count, 1), 1);
   }, 0) / scoreData.terms.length;
   const termsScore = termsRatio * termsWeight;

   // Internal links bonus/penalty:
   // +1 per link up to 5 (max +5), flat 5-10, then -1 per link above 10 (never below 0)
   let linksScore = 0;
   if (internalLinksCount !== undefined && internalLinksCount > 0) {
      const bonus = Math.min(internalLinksCount, 5);
      const penalty = internalLinksCount > 10 ? (internalLinksCount - 10) : 0;
      linksScore = Math.max(0, bonus - penalty);
   }

   return Math.round(wordScore + headingScore + paraScore + termsScore + linksScore);
}

export function scoreToColor(score: number): string {
   if (score >= 80) return '#22c55e'; // green
   if (score >= 50) return '#f97316'; // orange
   return '#ef4444'; // red
}

export function updateTermsCoverage(plainText: string, terms: NlpTerm[]): NlpTerm[] {
   return terms.map((t) => ({
      ...t,
      current_count: countOccurrences(plainText, t.term),
   }));
}
