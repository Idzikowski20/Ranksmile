import type { PipelineWorker } from '../types';
import type { FingerprintMetrics } from '../../corpus/corpusService';

/** Structural fingerprint of corpus competitor pages. */
export const fingerprintWorker: PipelineWorker = {
  id: 'fingerprint',
  queue: 'fingerprint',
  workerVersion: '1',
  retryPolicy: { maxAttempts: 2, backoffMs: 200 },
  costEstimate: () => 0.002,
  produces: ['fingerprint'],
  consumes: ['corpus'],
  async execute(ctx) {
    const corpusId = String(ctx.payload.corpusId || '');
    const docs = Array.isArray(ctx.payload.documents)
      ? (ctx.payload.documents as Array<{ html?: string; text?: string }>)
      : [];

    let h2 = 0;
    let faq = 0;
    let schema = 0;
    let tables = 0;
    let media = 0;
    let citations = 0;
    let paraLens: number[] = [];

    for (const d of docs) {
      const html = d.html || '';
      const text = d.text || html.replace(/<[^>]+>/g, ' ');
      h2 += (html.match(/<h2[\s>]/gi) || []).length;
      if (/faq|częste pytania|people also ask/i.test(html + text)) faq += 1;
      if (/application\/ld\+json|itemscope/i.test(html)) schema += 1;
      if (/<table[\s>]/i.test(html)) tables += 1;
      if (/<img[\s>]/i.test(html)) media += 1;
      citations += (html.match(/<a\s[^>]*href=["']https?:/gi) || []).length;
      const paras = text.split(/\n{2,}/).map((p) => p.trim().length).filter((n) => n > 40);
      paraLens = paraLens.concat(paras);
    }

    const n = Math.max(1, docs.length);
    const metrics: FingerprintMetrics = {
      h2Avg: h2 / n,
      faqRate: faq / n,
      schemaRate: schema / n,
      tablesRate: tables / n,
      mediaRate: media / n,
      citationsRate: Math.min(1, citations / (n * 10)),
      paraLenAvg: paraLens.length
        ? paraLens.reduce((a, b) => a + b, 0) / paraLens.length
        : 0,
      entityCount: Number(ctx.payload.entityCount ?? 0),
      conceptCount: Number(ctx.payload.conceptCount ?? 0),
    };

    if (corpusId) {
      const { upsertFingerprint } = await import('../../corpus/corpusService');
      await upsertFingerprint(corpusId, metrics);
      const { wireFingerprintFeatures } = await import('../../features/fingerprintFeatures');
      await wireFingerprintFeatures({
        workspaceId: String(ctx.payload.workspaceId || '0'),
        keyword: String(ctx.payload.keyword || ''),
        corpusVersion:
          ctx.payload.corpusVersion != null ? Number(ctx.payload.corpusVersion) : undefined,
        metrics,
        articleId: ctx.payload.articleId != null ? Number(ctx.payload.articleId) : undefined,
        domainId: ctx.payload.domainId != null ? Number(ctx.payload.domainId) : undefined,
      });
    }

    return {
      ok: true,
      estimatedCost: 0.002,
      actualCost: 0.001,
      snapshotId: corpusId || undefined,
      result: { metrics },
    };
  },
};
