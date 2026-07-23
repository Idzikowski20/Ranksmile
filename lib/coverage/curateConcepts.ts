import type { CoverageItem, Importance } from '../aiCoverage';
import { normalizeTerm } from '../termUtils';

export type TermLike = {
  term: string;
  doc_freq?: number;
  target_count?: number;
  salience?: number;
};

/**
 * Bootstrap CONCEPT / TERM coverage items from NLP terms — never label as ENTITY.
 * ENTITY comes only from NER worker (Etap 1.5).
 */
export function curateConceptsFromTerms(opts: {
  keyword: string;
  terms: TermLike[];
  urls?: string[];
}): { terms: CoverageItem[]; concepts: CoverageItem[]; entities: CoverageItem[] } {
  const termsOut: CoverageItem[] = [];
  const conceptsOut: CoverageItem[] = [];
  const seen = new Set<string>();

  for (const t of opts.terms) {
    const label = (t.term || '').trim();
    if (!label || label.length < 2) continue;
    const key = normalizeTerm(label);
    if (!key || seen.has(key)) continue;
    seen.add(key);

    const tokens = key.split(/\s+/).filter(Boolean);
    const isConcept = tokens.length >= 2;
    const importance: Importance =
      (t.doc_freq ?? 0) >= 5 || (t.salience ?? 0) >= 60 ? 'critical' : 'recommended';

    const item: CoverageItem = {
      id: `${isConcept ? 'concept' : 'term'}-${key.slice(0, 48)}`,
      label,
      type: isConcept ? 'concept' : 'term',
      category: 'knowledge',
      importance,
      source: 'serp',
      covered: false,
      quality: 0,
      confidence: Math.min(1, 0.4 + (t.doc_freq ?? 1) / 20),
    };

    if (isConcept) conceptsOut.push(item);
    else termsOut.push(item);

    if (termsOut.length + conceptsOut.length >= 40) break;
  }

  // ENTITY intentionally empty until NER
  return { terms: termsOut, concepts: conceptsOut, entities: [] };
}
