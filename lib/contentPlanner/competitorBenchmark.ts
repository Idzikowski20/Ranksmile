/**
 * Competitor Synthesis + Benchmark — Surfer-style structural aggregates.
 */
import type { CompetitorBenchmark, CompetitorProfile, CompetitorSynthesisMetrics } from './types';
import { BENCHMARK_H2_FLOOR, BENCHMARK_WORDS_FLOOR } from './types';

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function round(n: number): number {
  return Math.round(n);
}

function frequencyTopPerProfile(
  profiles: CompetitorProfile[],
  pick: (p: CompetitorProfile) => string[],
  minCount: number,
  limit: number,
): string[] {
  const map = new Map<string, number>();
  for (const p of profiles) {
    const seen = new Set<string>();
    for (const raw of pick(p)) {
      const k = raw.trim().toLowerCase();
      if (k.length < 3 || seen.has(k)) continue;
      seen.add(k);
      map.set(k, (map.get(k) || 0) + 1);
    }
  }
  return [...map.entries()]
    .filter(([, c]) => c >= minCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([k]) => k);
}

export function synthesizeCompetitors(profiles: CompetitorProfile[]): CompetitorSynthesisMetrics {
  const n = profiles.length;
  const words = profiles.map((p) => p.wordCount);
  const avgWords = mean(words);
  const medWords = median(words);
  const recommendedWords = round(Math.max(avgWords, medWords) * 1.05);

  const commonClaims = frequencyTopPerProfile(
    profiles, (p) => p.claims, Math.max(2, Math.ceil(n * 0.4)), 40,
  );
  const commonQuestions = frequencyTopPerProfile(
    profiles, (p) => p.questions, Math.max(2, Math.ceil(n * 0.3)), 20,
  );
  const commonEntities = frequencyTopPerProfile(
    profiles, (p) => p.entities, Math.max(2, Math.ceil(n * 0.3)), 30,
  );

  const claimFreq = new Map<string, number>();
  for (const p of profiles) {
    const seen = new Set<string>();
    for (const c of p.claims) {
      const k = c.trim().toLowerCase();
      if (!k || seen.has(k)) continue;
      seen.add(k);
      claimFreq.set(k, (claimFreq.get(k) || 0) + 1);
    }
  }
  const missingTopics = [...claimFreq.entries()]
    .filter(([, c]) => c === 1)
    .slice(0, 15)
    .map(([k]) => k);

  return {
    competitorCount: n,
    averageWords: round(avgWords),
    medianWords: round(medWords),
    recommendedWords,
    averageH2: round(mean(profiles.map((p) => p.headings))),
    averageParagraphs: round(mean(profiles.map((p) => p.paragraphs))),
    averageLists: round(mean(profiles.map((p) => p.lists))),
    averageTables: round(mean(profiles.map((p) => p.tables))),
    averageImages: round(mean(profiles.map((p) => p.images))),
    averageFaqs: round(mean(profiles.map((p) => p.faq))),
    averageClaims: round(mean(profiles.map((p) => p.claims.length))),
    averageExamples: round(mean(profiles.map((p) => p.examples))),
    averageQuestions: round(mean(profiles.map((p) => p.questions.length))),
    // Profiles store heading counts, not labels — do not substitute entities.
    commonHeadings: [],
    commonQuestions,
    commonEntities,
    commonClaims,
    missingTopics,
  };
}

export function buildCompetitorBenchmark(
  synth: CompetitorSynthesisMetrics,
): CompetitorBenchmark {
  const bestWords = Math.max(synth.averageWords, synth.recommendedWords);
  // Floor prevents empty/thin SERP from authorizing a short Execution Plan.
  const targetWords = Math.round(
    Math.max(BENCHMARK_WORDS_FLOOR, synth.recommendedWords, synth.averageWords * 1.02),
  );
  // A ceiling as well as a floor. `averageH2` counts every heading a competitor renders —
  // H3s, nav, footer — so a SERP of long pages asked for 22 top-level sections, and the
  // outline builder padded to match at ~100 words each. The reference tool reports the
  // same wide heading range for this keyword ("Headings: 19-52") and still briefs six H2:
  // the rest are H3 inside a section. The word budget is what decides how many H2 fit.
  const targetH2 = Math.min(
    Math.max(BENCHMARK_H2_FLOOR, Math.round(synth.averageH2 || h2FromWords(targetWords))),
    h2FromWords(targetWords),
  );
  return {
    averageWords: synth.averageWords,
    bestWords: Math.max(bestWords, targetWords),
    averageH2: synth.averageH2,
    averageParagraphs: Math.max(synth.averageParagraphs, Math.round(targetWords / 40)),
    averageLists: Math.max(synth.averageLists, Math.round(targetH2 * 1.1)),
    averageTables: Math.max(synth.averageTables, 1),
    averageImages: Math.max(synth.averageImages, 2),
    averageFaq: Math.max(synth.averageFaqs, 5),
    averageClaims: Math.max(synth.averageClaims, 8),
    averageExamples: Math.max(synth.averageExamples, Math.round(targetH2 * 0.5)),
    averageQuestions: Math.max(synth.averageQuestions, 6),
    targetWords,
    targetH2,
    commonHeadings: synth.commonHeadings?.length ? [...synth.commonHeadings] : [],
  };
}

/** Adaptive H2 count from word budget. */
export function h2FromWords(words: number): number {
  if (words <= 1400) return 7;
  if (words <= 2800) return 11;
  if (words <= 4800) return 16;
  return 22;
}
