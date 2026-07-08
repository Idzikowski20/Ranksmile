import type { ArticleFact } from './articleFactTypes';
import { factReadinessScore } from './factReadiness';

export type AiCitation = {
   prompt: string;
   answer?: string;
   cited_url?: string;
   cited_domain?: string;
   is_own_domain?: boolean;
   is_competitor?: boolean;
   answer_readiness_score?: number;
};

export type AiVisibilitySummary = {
   prompts_total: number;
   prompts_cited: number;
   competitor_citations: number;
   extractability_score: number;
   citations: AiCitation[];
};

/** Legacy PAA-readiness score — used when facts pipeline has not run. */
export function computeAiSearchScore(summary?: AiVisibilitySummary | null): number {
   if (!summary || summary.prompts_total <= 0) return 0;

   const scores = (summary.citations || [])
      .map((c) => c.answer_readiness_score ?? 0)
      .filter((n) => Number.isFinite(n));
   if (!scores.length) return 0;

   const coveredRate = summary.prompts_cited / summary.prompts_total;
   const avgReadiness = scores.reduce((a, b) => a + b, 0) / scores.length;
   const extractability = Math.min(Math.max(summary.extractability_score || avgReadiness, 0), 100) / 100;

   // Content coverage dominates (Surfer parity); extractability secondary.
   const coverageScore = coveredRate * 60;
   const readinessScore = (avgReadiness / 100) * 30;
   const extractScore = extractability * 10;

   return Math.round(Math.min(100, coverageScore + readinessScore + extractScore));
}

/** Surfer-style AI Search Score v2 — Facts Coverage (70%) + Upfront Intent (30%). */
export function computeAiSearchScoreV2(opts: {
   facts: ArticleFact[];
   articleText: string;
   intentScore?: number;
   answersMainQuestionEarly?: boolean;
}): number {
   const { facts, articleText } = opts;
   if (!facts.length) return 0;

   let weightSum = 0;
   let coveredSum = 0;
   for (const f of facts) {
      const w = Math.min(3, Math.max(1, f.sourceFrequency));
      weightSum += w;
      if (factReadinessScore(articleText, f.text) >= 65) coveredSum += w;
   }
   const factsCoverage = weightSum > 0 ? (coveredSum / weightSum) * 70 : 0;

   let intentPart = opts.intentScore ?? 0;
   if (opts.answersMainQuestionEarly) intentPart = Math.min(100, intentPart + 15);
   const intentScore = (Math.min(100, Math.max(0, intentPart)) / 100) * 30;

   return Math.round(Math.min(100, factsCoverage + intentScore));
}

export function resolveAiScore(opts: {
   facts?: ArticleFact[];
   articleText?: string;
   summary?: AiVisibilitySummary | null;
   intentScore?: number;
   answersMainQuestionEarly?: boolean;
   coverageOverall?: number | null;
}): number {
   if (opts.facts?.length && opts.articleText) {
      return computeAiSearchScoreV2({
         facts: opts.facts,
         articleText: opts.articleText,
         intentScore: opts.intentScore,
         answersMainQuestionEarly: opts.answersMainQuestionEarly,
      });
   }
   if (opts.coverageOverall != null && opts.coverageOverall > 0) return opts.coverageOverall;
   return computeAiSearchScore(opts.summary);
}

/** Surfer-style Content Score — weighted blend with weak-dimension floor. */
export function computeOverallContentScore(seoScore: number, aiScore: number): number {
   const seo = Math.min(100, Math.max(0, seoScore));
   const ai = Math.min(100, Math.max(0, aiScore));
   const weighted = seo * 0.55 + ai * 0.45;
   const floor = Math.min(seo, ai) * 0.8;
   return Math.round(Math.min(100, Math.max(weighted, floor)));
}

export function contentScoreSplit(seoScore: number, aiScore: number): { seoPct: number; aiPct: number } {
   const total = Math.max(1, seoScore + aiScore);
   return { seoPct: Math.round((seoScore / total) * 100), aiPct: Math.round((aiScore / total) * 100) };
}
