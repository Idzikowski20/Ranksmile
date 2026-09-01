/** Inflection-tolerant term matching — shared by content score + competitor scoring (client-safe). */
import { PL_DIACRITICS } from './plDiacritics';

function normalizePl(s: string): string {
  return (s || '').toLowerCase().replace(/[ąćęłńóśźż]/g, (c) => PL_DIACRITICS[c] || c);
}

function tokenize(s: string): string[] {
  return normalizePl(s).match(/[a-z0-9]+/g) || [];
}

function wordMatch(a: string, b: string): boolean {
  if (a === b) return true;
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i] === b[i]) i += 1;
  return i >= 4 && i >= n - 3;
}

/**
 * Compiled per-word alternations, cached per term. The regexps arrive from the sidecar
 * (analyzers/term_lemmas.py) already alternation-shaped; anchoring happens here. A
 * malformed pattern disables the whole set for that term rather than throwing into the
 * scoring loop — the fuzzy path below still works.
 */
const compiledCache = new Map<string, RegExp[] | null>();

function compileRegexps(regexps: readonly string[]): RegExp[] | null {
  const key = regexps.join(String.fromCharCode(0));
  const hit = compiledCache.get(key);
  if (hit !== undefined) return hit;
  let compiled: RegExp[] | null;
  try {
    // No `u` flag: the sidecar builds these with Python's re.escape, which emits `\-`
    // for a hyphen — legal in Python and in a non-unicode JS regexp, but a syntax error
    // under `u`, which would drop every hyphenated term to the fuzzy path. The patterns
    // are literal alternations of real characters, so `u` buys nothing here anyway.
    compiled = regexps.map((r) => new RegExp(`^(?:${r})$`, 'i'));
  } catch {
    compiled = null;
  }
  compiledCache.set(key, compiled);
  return compiled;
}

/** Raw-token split for the regexp path: the patterns carry real diacritics, so unlike
 *  `tokenize` this must not fold them away. */
function rawTokenize(s: string): string[] {
  return (s || '').toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
}

export function countOccurrences(text: string, term: string, regexps?: readonly string[]): number {
  // Exact inflection alternations when the analysis provides them — Surfer-style lemma
  // matching, which both counts declined forms ("usług detektywistycznych") and stops
  // the fuzzy path's overmatch ("detektyw" ≠ "detektywistyczne").
  const compiled = regexps?.length ? compileRegexps(regexps) : null;
  if (compiled) {
    const T = rawTokenize(text);
    let count = 0;
    for (let i = 0; i + compiled.length <= T.length; i += 1) {
      let ok = true;
      for (let j = 0; j < compiled.length; j += 1) {
        if (!compiled[j].test(T[i + j])) { ok = false; break; }
      }
      if (ok) count += 1;
    }
    return count;
  }

  const T = tokenize(text);
  const Q = tokenize(term);
  if (!T.length || !Q.length) return 0;
  let count = 0;
  for (let i = 0; i + Q.length <= T.length; i += 1) {
    let ok = true;
    for (let j = 0; j < Q.length; j += 1) {
      if (!wordMatch(T[i + j], Q[j])) { ok = false; break; }
    }
    if (ok) count += 1;
  }
  return count;
}

export { normalizePl, tokenize, wordMatch };
