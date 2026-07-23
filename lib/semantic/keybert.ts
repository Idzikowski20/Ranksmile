/**
 * KeyBERT-style keyword extraction (no ML deps) — TF × position boost + n-grams.
 */
export type KeyBertTerm = {
  term: string;
  score: number;
};

export function extractKeybertTerms(text: string, opts?: { topK?: number }): KeyBertTerm[] {
  const tokens = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3);

  const tf = new Map<string, number>();
  for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);

  // Bigrams
  for (let i = 0; i + 1 < tokens.length; i++) {
    const bg = `${tokens[i]} ${tokens[i + 1]}`;
    tf.set(bg, (tf.get(bg) || 0) + 1.4);
  }

  const early = new Set(tokens.slice(0, Math.min(80, tokens.length)));
  const scored: KeyBertTerm[] = [];
  for (const [term, freq] of tf) {
    const posBoost = early.has(term.split(' ')[0]) ? 1.25 : 1;
    const lenBoost = term.includes(' ') ? 1.3 : 1;
    scored.push({ term, score: freq * posBoost * lenBoost });
  }

  return scored.sort((a, b) => b.score - a.score).slice(0, opts?.topK ?? 25);
}
