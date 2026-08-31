/**
 * After compile: DA citations → contradicts → optional LLM gap quotes → persist.
 */
import type { CanonicalContentModel } from '@/src/core/ccm/types/ccm';
import { isFactNode } from '@/src/core/ccm/types/graph';
import type { CompileStore } from '@/src/core/intelligence/compileStore';
import { enrichCcmWithDaFacts } from '@/src/core/intelligence/enrichCcmWithDaFacts';
import { loadDaFactSeeds, researchedFactsToDaSeeds } from '@/src/core/intelligence/loadDaFactSeeds';
import { applyContradictHeuristics } from '@/src/core/intelligence/applyContradictHeuristics';
import { applyLlmGapEvidence } from '@/src/core/intelligence/applyLlmGapEvidence';

function htmlToPlain(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export async function applyDaFactEnrichment(opts: {
  readonly articleId: number;
  readonly model: CanonicalContentModel;
  readonly contentHtml?: string | null;
  readonly store?: CompileStore;
  /** Re-save enriched model (default true when store set). */
  readonly persist?: boolean;
  /** Fact Engine v3 LLM gap locate (default true). */
  readonly llmGaps?: boolean;
}): Promise<CanonicalContentModel> {
  const plain =
    opts.contentHtml != null && opts.contentHtml !== ''
      ? htmlToPlain(opts.contentHtml)
      : opts.model.ast.blocks.map((b) => b.text).join(' ');

  let model = opts.model;

  try {
    const seeds = await loadDaFactSeeds(opts.articleId, plain);
    if (seeds.length) {
      model = enrichCcmWithDaFacts(model, seeds);
    }
  } catch {
    // no DA seeds available
  }

  // The 4-engine sidecar harvest (score_data.researched_facts) carries per-fact engine
  // attribution + source websites — seed those too so the coverage panel shows the engine
  // icons and source favicons Surfer does.
  try {
    const { queryOne } = await import('@/src/infrastructure/db/query');
    const { getArticleIdSql } = await import('@/src/infrastructure/articles/articleSql');
    const idSql = await getArticleIdSql();
    const row = await queryOne<{ score_data: string | null }>(
      `SELECT score_data FROM articles WHERE ${idSql} = ? LIMIT 1`,
      [opts.articleId],
    );
    if (row?.score_data) {
      const sd = JSON.parse(row.score_data) as { researched_facts?: { claims?: string[]; sources?: unknown[] } };
      const rfSeeds = researchedFactsToDaSeeds(
        sd.researched_facts as Parameters<typeof researchedFactsToDaSeeds>[0],
        plain,
      );
      if (rfSeeds.length) {
        model = enrichCcmWithDaFacts(model, rfSeeds);
      }
    }
  } catch {
    // non-fatal — no researched facts / DB unavailable
  }

  model = applyContradictHeuristics(model);

  if (opts.llmGaps !== false) {
    const gaps = model.knowledge.graph.nodes
      .filter(isFactNode)
      .filter((f) => f.status === 'missing' || f.status === 'weak')
      .slice(0, 6)
      .map((f) => ({ id: f.id, statement: f.statement }));
    if (gaps.length) {
      try {
        const { locateGapEvidenceWithLlm } = await import('@/src/core/intelligence/llmGapFacts');
        const hits = await locateGapEvidenceWithLlm({ articlePlain: plain, gaps });
        if (hits.length) {
          model = applyLlmGapEvidence(model, hits);
        }
      } catch {
        // non-fatal — no LLM / timeout
      }
    }
  }

  if (model !== opts.model && opts.store && opts.persist !== false) {
    try {
      await opts.store.save(String(opts.articleId), model);
    } catch {
      // non-fatal
    }
  }
  return model;
}
