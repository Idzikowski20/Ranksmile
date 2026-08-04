/**
 * Live presence (07-runtime): cheap status flips from current plain text.
 * No new Facts / IR candidates. Immutable — returns a new CCM when anything changes.
 */
import type { CanonicalContentModel } from '../ccm/types/ccm';
import type { CoverageStatus } from '../ccm/types/status';
import type { KgNode } from '../ccm/types/graph';
import {
  isEntityNode,
  isFactNode,
  isIntentNode,
} from '../ccm/types/graph';
import { buildGraphIndexes } from '../ccm/buildIndexes';
import { graphQuery } from '../ccm/graphQuery';

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

function presentInText(haystack: string, needle: string): boolean {
  const n = normalize(needle);
  if (n.length < 3) return false;
  return haystack.includes(n);
}

function liveFactStatus(prev: CoverageStatus, present: boolean): CoverageStatus {
  if (present) {
    if (prev === 'weak') return 'partial';
    if (prev === 'partial') return 'partial';
    return 'covered';
  }
  return 'missing';
}

export type LivePresenceResult = {
  readonly model: CanonicalContentModel;
  /** True when at least one node status changed. */
  readonly changed: boolean;
  readonly flippedNodeIds: readonly string[];
};

/**
 * Flip fact / entity / intent coverage from plain text presence.
 * `compiledAt` unchanged; contentHash unchanged (same source compile).
 */
export function applyLivePresence(
  model: CanonicalContentModel,
  plainText: string,
): LivePresenceResult {
  const hay = normalize(plainText);
  const flipped: string[] = [];

  const nodes: KgNode[] = model.knowledge.graph.nodes.map((node) => {
    if (isFactNode(node)) {
      const present = presentInText(hay, node.statement);
      const next = liveFactStatus(node.status, present);
      if (next === node.status) return node;
      flipped.push(node.id);
      return { ...node, status: next };
    }
    if (isEntityNode(node)) {
      const present =
        presentInText(hay, node.canonicalName) ||
        node.aliases.some((a) => presentInText(hay, a));
      const next = liveFactStatus(node.status, present);
      if (next === node.status) return node;
      flipped.push(node.id);
      return { ...node, status: next };
    }
    return node;
  });

  // Intent: covered if any supporting fact is covered/partial after flips
  const draftModel: CanonicalContentModel = {
    ...model,
    knowledge: {
      graph: { nodes, edges: model.knowledge.graph.edges },
      indexes: buildGraphIndexes(nodes, model.knowledge.graph.edges),
    },
  };
  const q = graphQuery(draftModel);
  const withIntents: KgNode[] = draftModel.knowledge.graph.nodes.map((node) => {
    if (!isIntentNode(node)) return node;
    const supporters = q.neighbors(node.id, 'supports', 'in').filter(isFactNode);
    const present =
      supporters.length > 0
        ? supporters.some((f) => f.status === 'covered' || f.status === 'partial')
        : presentInText(hay, node.label);
    const next = liveFactStatus(node.status, present);
    if (next === node.status) return node;
    flipped.push(node.id);
    return { ...node, status: next };
  });

  if (flipped.length === 0) {
    return { model, changed: false, flippedNodeIds: [] };
  }

  const nextNodes = withIntents;
  return {
    model: {
      ...model,
      knowledge: {
        graph: { nodes: nextNodes, edges: model.knowledge.graph.edges },
        indexes: buildGraphIndexes(nextNodes, model.knowledge.graph.edges),
      },
    },
    changed: true,
    flippedNodeIds: flipped,
  };
}
