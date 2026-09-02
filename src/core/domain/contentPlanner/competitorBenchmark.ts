/**
 * Competitor Synthesis + Benchmark — Surfer-style structural aggregates.
 */
import type { CompetitorBenchmark, CompetitorProfile, CompetitorSynthesisMetrics } from '@/src/core/domain/contentPlanner/types';
import { BENCHMARK_H2_FLOOR, BENCHMARK_WORDS_FLOOR } from '@/src/core/domain/contentPlanner/types';

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
  // Median, not max(avg, med): one 6000-word outlier drags the mean and the planner
  // then prices every article against it — article 103 planned ~3300 words while the
  // scorer (and Surfer's own guideline for the same keyword: 2200-2530) targets the
  // median-shaped ~2200. The median IS what ranks typically looks like.
  const recommendedWords = round(medWords * 1.05);

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
  // Floor prevents an empty/thin SERP from authorizing a short Execution Plan — and only
  // that. Folded into the Math.max it also overrode SERPs that were measured perfectly
  // well but simply run short (median 920 on the keyword this was tuned against), which
  // is the SERP telling us what ranks, not a gap to paper over.
  // recommendedWords alone: the old Math.max with averageWords re-imported the outlier
  // inflation the median-based recommendation exists to avoid.
  // Ceiling as well as floor on the competitor median. An earlier 2000 cap was set against
  // a hand-picked Surfer article (~1767 words); but Surfer's own generator (ai_article__generate)
  // writes ~2657 words / 13 H2 for this same SERP, so the focused-length assumption undershot
  // parity. Cap near that real output — h2FromWords then lifts targetH2 to ~12 to match.
  const WORDS_CEIL = 2800;
  const measured = synth.recommendedWords;
  const targetWords = Math.min(
    WORDS_CEIL,
    Math.round(measured > 0 ? measured : BENCHMARK_WORDS_FLOOR),
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

/** Adaptive H2 count from word budget.
 *
 * ~1 H2 per 230 words, matching Surfer's generated article (1767 words → 8 H2) rather than
 * the old step curve, which jumped to 11 for anything over 1400 words and gave a
 * ~1900-word article eleven thin sections against Surfer's eight. */
export function h2FromWords(words: number): number {
  return Math.min(22, Math.max(6, Math.round(words / 230)));
}

/**
 * Words a competitor spends per content heading, measured rather than chosen. The SERP
 * analyzer strips nav/footer/header/aside before counting, so this is body structure:
 * a "prywatny detektyw warszawa" cohort ran ~1307 words across ~14 headings.
 */
const COMPETITOR_WORDS_PER_HEADING = 93;

/**
 * Shortest subsection worth its own heading, taken from the measured density above
 * rather than picked. An earlier guess of 120 blocked every split the planner could
 * actually offer: h2FromWords hands out ~218-word sections, so a 120 floor meant no
 * section ever qualified and the whole rule was inert.
 */
const MIN_SUBSECTION_WORDS = 95;

/** More than this inside one H2 stops being a section and becomes a list of sections. */
const MAX_SUBHEADINGS = 3;

/**
 * H3 subheadings a section of this length should carry.
 *
 * The scorer grades an article's heading count against that competitor density, and we
 * were losing the slot outright: nothing in the planner or the writer ever emitted an H3,
 * so a 1264-word article shipped ten headings against a target of fourteen, and the
 * score hint literally advised "use H3 inside H2 sections" — advice no code path could
 * follow.
 *
 * Raising the H2 count instead would hit the density and lose the article: h2FromWords
 * keeps ~230 words per top-level section deliberately, because padding to competitor
 * heading counts produced eleven thin sections where the reference tool briefs eight.
 * Competitors reach ~93 words per heading by nesting, and so should we — the top-level
 * outline stays as planned and the granularity arrives underneath it.
 */
export function subheadingsForSection(expectedWords: number): number {
  if (!Number.isFinite(expectedWords) || expectedWords < MIN_SUBSECTION_WORDS * 2) return 0;
  const headings = Math.round(expectedWords / COMPETITOR_WORDS_PER_HEADING);
  // One of those headings is the H2 itself; the rest are subsections, and each still has
  // to clear the minimum on its own.
  const byDensity = headings - 1;
  const byMinimum = Math.floor(expectedWords / MIN_SUBSECTION_WORDS) - 1;
  return Math.max(0, Math.min(MAX_SUBHEADINGS, byDensity, byMinimum));
}
