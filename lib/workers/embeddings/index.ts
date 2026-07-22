import type { PipelineWorker } from '../types';

/** Night embeddings worker — hash embed stub; real model via LLM Gateway later. */
export const embeddingsWorker: PipelineWorker = {
  id: 'embeddings',
  queue: 'embeddings',
  workerVersion: '1',
  retryPolicy: { maxAttempts: 1, backoffMs: 0 },
  costEstimate: () => 0.02,
  produces: ['embeddings', 'semantic_gaps'],
  consumes: ['corpus'],
  async execute(ctx) {
    const { hashEmbed, findEmbeddingGaps, pgvectorResearchNotes } = await import(
      '../../semantic/embeddings'
    );
    const { extractKeybertTerms } = await import('../../semantic/keybert');
    const { storeHashEmbeddings } = await import('../../semantic/embeddingStore');

    const articleText = String(ctx.payload.plainText || ctx.payload.html || '').replace(
      /<[^>]+>/g,
      ' ',
    );
    const corpusTexts = Array.isArray(ctx.payload.corpusTexts)
      ? (ctx.payload.corpusTexts as Array<{ id: string; text: string }>)
      : [];

    const keybert = extractKeybertTerms(articleText || corpusTexts.map((c) => c.text).join(' '), {
      topK: 20,
    });
    const gaps = articleText
      ? findEmbeddingGaps({ articleText, corpusTexts })
      : [];

    const persist = await storeHashEmbeddings({
      workspaceId: String(ctx.payload.workspaceId || '0'),
      docs: corpusTexts.length
        ? corpusTexts
        : keybert.slice(0, 15).map((t, i) => ({ id: `kw-${i}`, text: t.term })),
    });

    return {
      ok: true,
      estimatedCost: 0.02,
      actualCost: 0.001,
      result: {
        keybert,
        gaps: gaps.slice(0, 15),
        vectorsStored: persist.stored,
        pgvector: persist.pgvectorNotes,
        hashSampleDims: hashEmbed('ping').length,
        research: pgvectorResearchNotes(),
      },
    };
  },
};
