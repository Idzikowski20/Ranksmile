/**
 * BM25-like harvest assign — rank candidate questions/topics against article/corpus.
 */
export type Bm25Doc = { id: string; text: string };

export type Bm25Hit = { id: string; score: number };

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 2);
}

export function bm25Rank(opts: {
  query: string;
  docs: Bm25Doc[];
  k1?: number;
  b?: number;
  limit?: number;
}): Bm25Hit[] {
  const k1 = opts.k1 ?? 1.2;
  const b = opts.b ?? 0.75;
  const qTokens = tokenize(opts.query);
  if (!qTokens.length || !opts.docs.length) return [];

  const docsTok = opts.docs.map((d) => ({ id: d.id, toks: tokenize(d.text) }));
  const avgdl = docsTok.reduce((s, d) => s + d.toks.length, 0) / docsTok.length;
  const df = new Map<string, number>();
  for (const d of docsTok) {
    const uniq = new Set(d.toks);
    for (const t of uniq) df.set(t, (df.get(t) || 0) + 1);
  }
  const N = docsTok.length;

  const hits: Bm25Hit[] = docsTok.map((d) => {
    const tfMap = new Map<string, number>();
    for (const t of d.toks) tfMap.set(t, (tfMap.get(t) || 0) + 1);
    let score = 0;
    for (const qt of qTokens) {
      const tf = tfMap.get(qt) || 0;
      if (!tf) continue;
      const n = df.get(qt) || 0;
      const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
      const denom = tf + k1 * (1 - b + b * (d.toks.length / Math.max(1, avgdl)));
      score += idf * ((tf * (k1 + 1)) / denom);
    }
    return { id: d.id, score };
  });

  return hits
    .filter((h) => h.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, opts.limit ?? 20);
}

/** Assign harvested questions to best-matching outline section ids. */
export function assignHarvestToSections(opts: {
  questions: Array<{ id: string; text: string }>;
  sections: Array<{ id: string; heading: string; body?: string }>;
}): Array<{ questionId: string; sectionId: string; score: number }> {
  const docs = opts.sections.map((s) => ({
    id: s.id,
    text: `${s.heading} ${s.body || ''}`,
  }));
  const out: Array<{ questionId: string; sectionId: string; score: number }> = [];
  for (const q of opts.questions) {
    const ranked = bm25Rank({ query: q.text, docs, limit: 1 });
    if (ranked[0]) {
      out.push({ questionId: q.id, sectionId: ranked[0].id, score: ranked[0].score });
    }
  }
  return out;
}
