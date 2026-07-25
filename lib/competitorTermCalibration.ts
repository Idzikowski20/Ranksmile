/**
 * Ranksmile-style term range calibration — min/max usage counts across competitor pages.
 */
import type { NlpTerm } from './contentScore';
import { countOccurrences } from './termMatch';
import { isUsefulTerm, normalizeTerm } from './termUtils';

/** Per-term occurrence counts across a competitor corpus → suggested_min/max + target_count. */
export function calibrateTermRangesFromCorpus(terms: NlpTerm[], corpusTexts: string[]): NlpTerm[] {
  if (!corpusTexts.length || !terms.length) return terms;

  return terms.map((t) => {
    const counts = corpusTexts.map((text) => countOccurrences(text, t.term));
    const nonzero = counts.filter((c) => c > 0);
    if (!nonzero.length) return t;

    const sMin = Math.min(...nonzero);
    const sMax = Math.ceil(Math.max(...nonzero) * 1.12);
    const target = Math.max(1, Math.round(nonzero.reduce((a, b) => a + b, 0) / nonzero.length));
    const docFreq = nonzero.length;

    return {
      ...t,
      suggested_min: sMin,
      suggested_max: sMax,
      target_count: target,
      doc_freq: docFreq,
    };
  });
}

/** Drop stopwords / trivial unigrams; dedupe by match key; keep display orthography. */
export function filterUsefulNlpTerms(terms: NlpTerm[]): NlpTerm[] {
  const best = new Map<string, NlpTerm>();
  const scored = terms
    .map((t) => ({ ...t, term: (t.term || '').trim() }))
    .filter((t) => t.term && isUsefulTerm(t.term))
    .sort((a, b) => {
      const salDiff = (b.salience ?? Math.round((b.relevance ?? 0) * 100)) - (a.salience ?? Math.round((a.relevance ?? 0) * 100));
      if (salDiff !== 0) return salDiff;
      const aw = a.term.split(/\s+/).length;
      const bw = b.term.split(/\s+/).length;
      if (bw !== aw) return bw - aw;
      return (b.doc_freq ?? 0) - (a.doc_freq ?? 0);
    });

  for (const t of scored) {
    const key = normalizeTerm(t.term);
    const prev = best.get(key);
    if (!prev) {
      best.set(key, t);
      continue;
    }
    const prevDiacritics = /[ąćęłńóśźż]/i.test(prev.term);
    const nextDiacritics = /[ąćęłńóśźż]/i.test(t.term);
    if (nextDiacritics && !prevDiacritics) best.set(key, { ...prev, ...t, term: t.term });
    else if (!prevDiacritics && !nextDiacritics && t.term.length > prev.term.length) {
      best.set(key, { ...prev, ...t, term: t.term });
    }
  }
  return [...best.values()];
}

/** True when the list is mostly stopwords, unigrams, or too thin for Ranksmile-style scoring. */
export function isWeakTermList(terms: NlpTerm[], primaryKeyword: string): boolean {
  if (!terms.length) return true;
  if (terms.length < 12) return true;

  const pk = normalizeTerm(primaryKeyword);
  const weak = terms.filter((t) => {
    const term = normalizeTerm(t.term);
    if (!isUsefulTerm(term)) return true;
    const words = term.split(/\s+/);
    if (words.length === 1 && pk && !pk.includes(term) && term.length < 6) return true;
    return false;
  });

  if (weak.length / terms.length >= 0.25) return true;

  const avgWords = terms.reduce((s, t) => s + t.term.split(/\s+/).length, 0) / terms.length;
  return avgWords < 1.6;
}

/** Ranksmile-style: rescale min/max/target to current article word count vs corpus average. */
export function scaleTermRangesToWordCount(
  terms: NlpTerm[],
  articleWords: number,
  corpusAvgWords: number,
): NlpTerm[] {
  if (!corpusAvgWords || articleWords <= 0) return terms;
  const ratio = articleWords / corpusAvgWords;
  return terms.map((t) => {
    const sMin = t.suggested_min ?? Math.max(1, Math.round((t.target_count ?? 1) * 0.7));
    const sMax = t.suggested_max ?? Math.max(sMin, t.target_count ?? 1);
    return {
      ...t,
      suggested_min: Math.max(1, Math.round(sMin * ratio)),
      suggested_max: Math.max(Math.max(1, Math.round(sMin * ratio)), Math.round(sMax * ratio)),
      target_count: Math.max(1, Math.round((t.target_count ?? 1) * ratio)),
    };
  });
}

/** Ranksmile requires ≥3 distinct competitor domains for reliable scoring. */
export function hasMinCompetitorDomains(domains: string[]): boolean {
  const unique = new Set(domains.map((d) => d.replace(/^www\./, '').toLowerCase()).filter(Boolean));
  return unique.size >= 3;
}
