import type { PipelineWorker } from '../types';

/** Lightweight TF-IDF term extraction from competitor texts (Node-side stub). */
export const tfidfWorker: PipelineWorker = {
  id: 'tfidf',
  queue: 'tfidf',
  workerVersion: '1',
  retryPolicy: { maxAttempts: 2, backoffMs: 200 },
  costEstimate: () => 0.003,
  produces: ['terms'],
  consumes: ['corpus'],
  async execute(ctx) {
    const docs = Array.isArray(ctx.payload.documents)
      ? (ctx.payload.documents as Array<{ text?: string }>)
      : [];
    const keyword = String(ctx.payload.keyword || '');
    const df = new Map<string, number>();
    const tf = new Map<string, number>();

    for (const d of docs) {
      const tokens = (d.text || '')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .split(/\s+/)
        .filter((t) => t.length >= 3 && t.length <= 40);
      const uniq = new Set(tokens);
      for (const t of uniq) df.set(t, (df.get(t) || 0) + 1);
      for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
    }

    const N = Math.max(1, docs.length);
    const terms = [...df.entries()]
      .map(([term, doc_freq]) => {
        const idf = Math.log(1 + N / doc_freq);
        const score = (tf.get(term) || 0) * idf;
        return {
          term,
          doc_freq,
          target_count: Math.max(1, Math.round(doc_freq / 2)),
          salience: Math.min(100, Math.round(score)),
        };
      })
      .filter((t) => t.doc_freq >= Math.min(2, N) || t.term.includes(keyword.toLowerCase().split(/\s+/)[0] || ''))
      .sort((a, b) => b.salience - a.salience)
      .slice(0, 60);

    return {
      ok: true,
      estimatedCost: 0.003,
      actualCost: 0.002,
      result: { terms },
      nextPayload: { ...ctx.payload, terms },
    };
  },
};
