/**
 * Embeddings research helpers — pgvector readiness (no hard dep on pgvector).
 * Night worker stores vectors as JSON until pgvector extension is available.
 */
export type EmbeddingRecord = {
  id: string;
  text: string;
  vector: number[];
  model: string;
};

/** Deterministic bag-of-chars embedding stub for tests / offline. */
export function hashEmbed(text: string, dims = 32): number[] {
  const v = new Array(dims).fill(0);
  const norm = text.toLowerCase();
  for (let i = 0; i < norm.length; i++) {
    const code = norm.charCodeAt(i);
    v[code % dims] += 1;
    v[(code * 7) % dims] += 0.5;
  }
  const mag = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / mag);
}

export function cosineSim(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const d = Math.sqrt(na) * Math.sqrt(nb);
  return d ? dot / d : 0;
}

/** Research gap: texts in corpus without a close match in article. */
export function findEmbeddingGaps(opts: {
  articleText: string;
  corpusTexts: Array<{ id: string; text: string }>;
  threshold?: number;
}): Array<{ id: string; similarity: number }> {
  const article = hashEmbed(opts.articleText);
  const thr = opts.threshold ?? 0.55;
  return opts.corpusTexts
    .map((c) => ({ id: c.id, similarity: cosineSim(article, hashEmbed(c.text)) }))
    .filter((x) => x.similarity < thr)
    .sort((a, b) => a.similarity - b.similarity);
}

export type PgvectorResearchNote = {
  extension: 'pgvector';
  recommendedIndex: 'ivfflat' | 'hnsw';
  sqlStub: string;
};

export function pgvectorResearchNotes(): PgvectorResearchNote {
  return {
    extension: 'pgvector',
    recommendedIndex: 'hnsw',
    sqlStub: `
CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE IF NOT EXISTS content_embeddings (
  id TEXT PRIMARY KEY,
  workspace_id TEXT,
  model TEXT,
  embedding vector(1536),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_content_embeddings_hnsw
  ON content_embeddings USING hnsw (embedding vector_cosine_ops);
`.trim(),
  };
}
