/**
 * Coverage Engine — materialize typed coverage checklist from SERP/NLP/PAA.
 * Does not invent ENTITY (NER only).
 */
import type { CoverageItem } from '../aiCoverage';
import { curateConceptsFromTerms, type TermLike } from '../coverage/curateConcepts';
import { normalizeTerm } from '../termUtils';

export type CoverageEngineInput = {
  keyword: string;
  terms?: TermLike[];
  paaQuestions?: Array<{ question: string; answer?: string }>;
  facts?: Array<{ label: string; confidence?: number }>;
  urls?: string[];
};

export type CoverageEngineResult = {
  items: CoverageItem[];
  byType: Record<string, CoverageItem[]>;
};

export function runCoverageEngine(input: CoverageEngineInput): CoverageEngineResult {
  const curated = curateConceptsFromTerms({
    keyword: input.keyword,
    terms: input.terms ?? [],
    urls: input.urls,
  });

  const questions: CoverageItem[] = [];
  const seenQ = new Set<string>();
  for (const q of input.paaQuestions ?? []) {
    const label = (q.question || '').trim();
    if (label.length < 8) continue;
    const key = normalizeTerm(label);
    if (!key || seenQ.has(key)) continue;
    seenQ.add(key);
    questions.push({
      id: `question-${key.slice(0, 48)}`,
      label,
      type: 'question',
      category: 'knowledge',
      importance: 'recommended',
      source: 'paa',
      covered: false,
      quality: 0,
      confidence: 0.6,
    });
    if (questions.length >= 20) break;
  }

  const facts: CoverageItem[] = (input.facts ?? []).slice(0, 15).map((f, i) => ({
    id: `fact-${normalizeTerm(f.label).slice(0, 40) || i}`,
    label: f.label,
    type: 'fact' as const,
    category: 'knowledge' as const,
    importance: (f.confidence ?? 0.5) >= 0.7 ? ('critical' as const) : ('recommended' as const),
    source: 'serp' as const,
    covered: false,
    quality: 0,
    confidence: f.confidence ?? 0.5,
  }));

  const items = [
    ...curated.terms,
    ...curated.concepts,
    ...curated.entities,
    ...questions,
    ...facts,
  ];

  const byType: Record<string, CoverageItem[]> = {};
  for (const it of items) {
    (byType[it.type] ??= []).push(it);
  }

  return { items, byType };
}
