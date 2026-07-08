/** Inflection-tolerant term matching — shared by content score + competitor scoring (client-safe). */
const PL_DIACRITICS: Record<string, string> = { ą: 'a', ć: 'c', ę: 'e', ł: 'l', ń: 'n', ó: 'o', ś: 's', ź: 'z', ż: 'z' };

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

export function countOccurrences(text: string, term: string): number {
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
