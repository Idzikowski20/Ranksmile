/**
 * After compile: DA citations → contradicts → optional LLM gap quotes → persist.
 */
import type { CanonicalContentModel } from '../ccm/types/ccm';
import { isFactNode } from '../ccm/types/graph';
import type { CompileStore } from './compileStore';
import { enrichCcmWithDaFacts } from './enrichCcmWithDaFacts';
import { loadDaFactSeeds } from './loadDaFactSeeds';
import { applyContradictHeuristics } from './applyContradictHeuristics';
import { applyLlmGapEvidence } from './applyLlmGapEvidence';

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

  model = applyContradictHeuristics(model);

  if (opts.llmGaps !== false) {
    const gaps = model.knowledge.graph.nodes
      .filter(isFactNode)
      .filter((f) => f.status === 'missing' || f.status === 'weak')
      .slice(0, 6)
      .map((f) => ({ id: f.id, statement: f.statement }));
    if (gaps.length) {
      try {
        const { locateGapEvidenceWithLlm } = await import('./llmGapFacts');
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
