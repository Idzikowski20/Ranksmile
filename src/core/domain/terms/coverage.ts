import { normalizePl, tokenize, wordMatch } from './termMatch';

/**
 * For a single text node, return each term's match ranges (char offsets into
 * `text`) using the same inflection-tolerant matching as countOccurrences. Tokenizes
 * the text once for all terms — used by the editor's term-highlight decorations.
 * normalizePl is length-preserving, so indices map straight back onto `text`.
 */
export function findTermRangesBatch(text: string, terms: string[]): Array<{ term: string; ranges: Array<[number, number]> }> {
  if (!text || !terms.length) return [];
  const norm = normalizePl(text);
  const toks: Array<{ w: string; start: number; end: number }> = [];
  const re = /[a-z0-9]+/g;
  let m: RegExpExecArray | null = re.exec(norm);
  while (m !== null) { toks.push({ w: m[0], start: m.index, end: m.index + m[0].length }); m = re.exec(norm); }
  if (!toks.length) return terms.map((term) => ({ term, ranges: [] }));
  return terms.map((term) => {
    const Q = tokenize(term);
    const ranges: Array<[number, number]> = [];
    if (Q.length) {
      for (let i = 0; i + Q.length <= toks.length; i += 1) {
        let ok = true;
        for (let j = 0; j < Q.length; j += 1) { if (!wordMatch(toks[i + j].w, Q[j])) { ok = false; break; } }
        if (ok) ranges.push([toks[i].start, toks[i + Q.length - 1].end]);
      }
    }
    return { term, ranges };
  });
}

/** Coverage status of a term vs. its target — shared by the panel chips and the editor highlight. */
export type Coverage = 'red' | 'yellow' | 'green';
export function termCoverage(t: { current_count?: number; target_count: number }): Coverage {
  const cur = t.current_count ?? 0;
  if (cur === 0) return 'red';
  if (cur < t.target_count) return 'yellow';
  return 'green';
}

/** Human usage hint shown in the term tooltip (panel + editor highlight). */
export function termUsageHint(t: { current_count?: number; target_count: number }): string {
  const cur = t.current_count ?? 0;
  const tgt = Math.max(t.target_count, 1);
  if (cur >= tgt) return "Good job. You're in optimal range.";
  if (cur === 0) return tgt > 1 ? `Use ${tgt} times. Currently used 0 times.` : 'Use at least once. Currently used 0 times.';
  return `Use ${tgt} time${tgt !== 1 ? 's' : ''}. Currently used ${cur} time${cur !== 1 ? 's' : ''}.`;
}
