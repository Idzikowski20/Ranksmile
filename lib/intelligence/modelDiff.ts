import type { CanonicalContentModel } from '../ccm/types/ccm';
import type { ActionGraph } from '../ccm/types/actionGraph';
import type { KgNode } from '../ccm/types/graph';

export type AstDiff = {
  readonly addedBlockIds: readonly string[];
  readonly removedBlockIds: readonly string[];
  readonly changedBlockIds: readonly string[];
};

export type GraphDiff = {
  readonly addedNodeIds: readonly string[];
  readonly removedNodeIds: readonly string[];
  readonly changedNodeIds: readonly string[];
  readonly addedEdgeIds: readonly string[];
  readonly removedEdgeIds: readonly string[];
};

export type ScoreDiff = {
  readonly contentScoreDelta: number;
  readonly coverageOverallDelta: number;
};

export type RecommendationDiff = {
  readonly addedActionIds: readonly string[];
  readonly removedActionIds: readonly string[];
};

export type ModelDiff = {
  readonly beforeVersion: number;
  readonly afterVersion: number;
  readonly identicalCompile: boolean;
  readonly astDiff: AstDiff;
  readonly graphDiff: GraphDiff;
  readonly scoreDiff: ScoreDiff;
  readonly recommendationDiff: RecommendationDiff;
};

function setDiff(before: readonly string[], after: readonly string[]) {
  const b = new Set(before);
  const a = new Set(after);
  return {
    added: after.filter((id) => !b.has(id)),
    removed: before.filter((id) => !a.has(id)),
  };
}

function nodeFingerprint(n: KgNode): string {
  if (n.kind === 'fact') {
    return `${n.kind}|${n.status}|${n.statement}|${n.confidence}`;
  }
  if (n.kind === 'intent') {
    return `${n.kind}|${n.status}|${n.label}|${n.primary}`;
  }
  if (n.kind === 'entity') {
    return `${n.kind}|${n.canonicalName}|${n.status}`;
  }
  if (n.kind === 'evidence_span') {
    return `${n.kind}|${n.snippet}|${n.evidenceKind}`;
  }
  return `${n.kind}|${'id' in n ? n.id : ''}`;
}

export type DiffModelsOpts = {
  readonly beforeActions?: ActionGraph;
  readonly afterActions?: ActionGraph;
};

/** Derive multi-layer ModelDiff (Judge/UI). Not history substrate. */
export function diffModels(
  before: CanonicalContentModel,
  after: CanonicalContentModel,
  opts: DiffModelsOpts = {},
): ModelDiff {
  const beforeBlocks = before.ast.blocks.map((b) => b.blockId);
  const afterBlocks = after.ast.blocks.map((b) => b.blockId);
  const blockSets = setDiff(beforeBlocks, afterBlocks);
  const beforeBlockText = new Map(before.ast.blocks.map((b) => [b.blockId, b.text]));
  const changedBlockIds = after.ast.blocks
    .filter((b) => {
      const prev = beforeBlockText.get(b.blockId);
      return prev !== undefined && prev !== b.text;
    })
    .map((b) => b.blockId);

  const beforeNodes = before.knowledge.graph.nodes;
  const afterNodes = after.knowledge.graph.nodes;
  const beforeNodeIds = beforeNodes.map((n) => n.id);
  const afterNodeIds = afterNodes.map((n) => n.id);
  const nodeSets = setDiff(beforeNodeIds, afterNodeIds);
  const beforeFp = new Map(beforeNodes.map((n) => [n.id, nodeFingerprint(n)]));
  const changedNodeIds = afterNodes
    .filter((n) => {
      const prev = beforeFp.get(n.id);
      return prev !== undefined && prev !== nodeFingerprint(n);
    })
    .map((n) => n.id);

  const beforeEdges = before.knowledge.graph.edges.map((e) => e.id);
  const afterEdges = after.knowledge.graph.edges.map((e) => e.id);
  const edgeSets = setDiff(beforeEdges, afterEdges);

  const beforeActionIds = opts.beforeActions?.actions.map((a) => a.id) ?? [];
  const afterActionIds = opts.afterActions?.actions.map((a) => a.id) ?? [];
  const actionSets = setDiff(beforeActionIds, afterActionIds);

  return {
    beforeVersion: before.version,
    afterVersion: after.version,
    identicalCompile:
      before.compiler.deterministicHash === after.compiler.deterministicHash,
    astDiff: {
      addedBlockIds: blockSets.added,
      removedBlockIds: blockSets.removed,
      changedBlockIds,
    },
    graphDiff: {
      addedNodeIds: nodeSets.added,
      removedNodeIds: nodeSets.removed,
      changedNodeIds,
      addedEdgeIds: edgeSets.added,
      removedEdgeIds: edgeSets.removed,
    },
    scoreDiff: {
      contentScoreDelta: after.metrics.contentScore - before.metrics.contentScore,
      coverageOverallDelta:
        after.metrics.coverageView.overall - before.metrics.coverageView.overall,
    },
    recommendationDiff: {
      addedActionIds: actionSets.added,
      removedActionIds: actionSets.removed,
    },
  };
}
