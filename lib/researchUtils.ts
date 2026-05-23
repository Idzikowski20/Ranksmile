// lib/researchUtils.ts
// Pure utility functions for ResearchOutlinePanel — Jaccard similarity,
// heading gap classification, PAA coverage, and SERP Insights computation.

import type { CompetitorOutline } from '../components/articles/ResearchOutlinePanel';

/**
 * Jaccard similarity between two strings based on words with length > 3.
 * Returns 0–1.
 */
export function jaccardSimilarity(a: string, b: string): number {
  const words = (s: string) =>
    new Set(s.toLowerCase().replace(/[^a-ząćęłńóśźża-z\s]/gi, '').split(/\s+/).filter((w) => w.length > 3));
  const setA = words(a);
  const setB = words(b);
  if (setA.size === 0 && setB.size === 0) return 0;
  const intersection = new Set([...setA].filter((w) => setB.has(w)));
  const union = new Set([...setA, ...setB]);
  return intersection.size / union.size;
}

/**
 * Classify a generated heading against the current article headings.
 * Uses Jaccard similarity: >= 50% → covered, 20–49% → expand, < 20% → missing.
 * When currentHeadings is empty all headings are 'missing' (new article).
 */
export function classifyHeadingStatus(
  heading: { level: number; text: string },
  currentHeadings: Array<{ level: number; text: string }>,
): 'covered' | 'expand' | 'missing' {
  if (currentHeadings.length === 0) return 'missing';
  const maxOverlap = Math.max(...currentHeadings.map((ch) => jaccardSimilarity(heading.text, ch.text)));
  if (maxOverlap >= 0.5) return 'covered';
  if (maxOverlap >= 0.2) return 'expand';
  return 'missing';
}

/**
 * Check whether a PAA question is covered by any current heading (Jaccard >= 50%).
 */
export function isPaaCovered(
  question: string,
  currentHeadings: Array<{ level: number; text: string }>,
): boolean {
  return currentHeadings.some((h) => jaccardSimilarity(question, h.text) >= 0.5);
}

/**
 * Compute SERP Insights from competitor data.
 * - avgWordCount: mean of competitor word_count values
 * - commonTopics: words (length > 3) appearing in >= 3 competitors, sorted by frequency desc
 */
export function computeSerpInsights(competitors: CompetitorOutline[]): {
  avgWordCount: number;
  commonTopics: string[];
} {
  if (competitors.length === 0) return { avgWordCount: 0, commonTopics: [] };

  const avgWordCount = Math.round(
    competitors.reduce((s, c) => s + (c.word_count ?? 0), 0) / competitors.length,
  );

  // word → Set of competitor indices
  const wordCompetitors = new Map<string, Set<number>>();
  competitors.forEach((comp, idx) => {
    comp.headings.forEach((h) => {
      const words = h.text
        .toLowerCase()
        .replace(/[^a-ząćęłńóśźża-z\s]/gi, '')
        .split(/\s+/)
        .filter((w) => w.length > 3);
      words.forEach((w) => {
        if (!wordCompetitors.has(w)) wordCompetitors.set(w, new Set());
        wordCompetitors.get(w)!.add(idx);
      });
    });
  });

  const threshold = Math.min(3, competitors.length);
  const commonTopics = Array.from(wordCompetitors.entries())
    .filter(([, comps]) => comps.size >= threshold)
    .sort((a, b) => b[1].size - a[1].size)
    .map(([word]) => word);

  return { avgWordCount, commonTopics };
}
