/**
 * Apply LLM gap-evidence hits onto CCM facts (Etap 30).
 */
import type { CanonicalContentModel } from '../ccm/types/ccm';
import { buildGraphIndexes } from '../ccm/buildIndexes';
import {
  isFactNode,
  type EvidenceSpanNode,
  type FactNode,
  type KgEdge,
  type KgNode,
} from '../ccm/types/graph';
import type { GapLocateHit } from './llmGapFacts';

function firstBlockId(model: CanonicalContentModel): string {
  return model.ast.blocks[0]?.blockId ?? 'b_llm';
}

export function applyLlmGapEvidence(
  model: CanonicalContentModel,
  hits: readonly GapLocateHit[],
): CanonicalContentModel {
  if (!hits.length) return model;
  const byId = new Map(hits.map((h) => [h.id, h]));
  const nodes: KgNode[] = [];
  const edges: KgEdge[] = [...model.knowledge.graph.edges];
  const blockId = firstBlockId(model);
  let bumped = 0;

  for (const n of model.knowledge.graph.nodes) {
    if (!isFactNode(n)) {
      nodes.push(n);
      continue;
    }
    const hit = byId.get(n.id);
    if (!hit) {
      nodes.push(n);
      continue;
    }
    const updated: FactNode = {
      ...n,
      status: 'covered',
      confidence: Math.max(n.confidence, 0.75),
      verification: 'verified',
    };
    nodes.push(updated);
    bumped += 1;
    const evId = `ev_llm_${n.id}`;
    if (!nodes.some((x) => x.id === evId)) {
      const ev: EvidenceSpanNode = {
        id: evId,
        kind: 'evidence_span',
        blockId,
        startOffset: 0,
        endOffset: Math.min(hit.quote.length, 120),
        snippet: hit.quote.slice(0, 160),
        evidenceKind: 'quote',
        confidence: 0.8,
        status: 'covered',
      };
      nodes.push(ev);
      edges.push({
        id: `e_supportedBy_${n.id}_${evId}`,
        type: 'supportedBy',
        from: n.id,
        to: evId,
        confidence: 0.8,
      });
    }
  }

  if (!bumped) return model;
  return {
    ...model,
    knowledge: {
      graph: { nodes, edges },
      indexes: buildGraphIndexes(nodes, edges),
    },
    compiler: {
      ...model.compiler,
      notes: [...model.compiler.notes, `llm-gaps:+${bumped}`],
    },
  };
}
