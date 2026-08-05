import type { CanonicalContentModel } from '../ccm/types/ccm';
import type { CompilerStageId } from '../ccm/types/compilerMeta';
import { graphQuery } from '../ccm/graphQuery';
import { isFactNode, isIntentNode } from '../ccm/types/graph';

export type CompileDependencyGraph = {
  readonly blockToFactIds: Readonly<Record<string, readonly string[]>>;
  readonly factToIntentIds: Readonly<Record<string, readonly string[]>>;
  readonly intentToQuestionIds: Readonly<Record<string, readonly string[]>>;
  readonly factToEvidenceIds: Readonly<Record<string, readonly string[]>>;
  readonly blockToIrClaimIds: Readonly<Record<string, readonly string[]>>;
};

export type InvalidationGraph = {
  readonly dirtyBlockIds: readonly string[];
  readonly dirtyCandidateIds: readonly string[];
  readonly dirtyNodeIds: readonly string[];
  readonly dirtyPassIds: readonly CompilerStageId[];
  readonly dirtyProjectionIds: readonly string[];
};

function pushRec(
  map: Record<string, string[]>,
  key: string,
  value: string,
): void {
  const list = map[key];
  if (list) {
    if (!list.includes(value)) list.push(value);
  } else map[key] = [value];
}

/** Structural dependency graph from a CCM snapshot. */
export function getDependencyGraph(model: CanonicalContentModel): CompileDependencyGraph {
  const blockToFactIds: Record<string, string[]> = {};
  const factToIntentIds: Record<string, string[]> = {};
  const intentToQuestionIds: Record<string, string[]> = {};
  const factToEvidenceIds: Record<string, string[]> = {};
  const blockToIrClaimIds: Record<string, string[]> = {};

  for (const fact of model.knowledge.graph.nodes) {
    if (!isFactNode(fact)) continue;
    if (fact.sectionId) pushRec(blockToFactIds, fact.sectionId, fact.id);
  }

  for (const e of model.knowledge.graph.edges) {
    if (e.type === 'supports') pushRec(factToIntentIds, e.from, e.to);
    if (e.type === 'supportedBy') pushRec(factToEvidenceIds, e.from, e.to);
    if (e.type === 'answers') pushRec(intentToQuestionIds, e.to, e.from);
    if (e.type === 'answeredBy') pushRec(intentToQuestionIds, e.from, e.to);
  }

  for (const claim of model.ir.claims) {
    pushRec(blockToIrClaimIds, claim.blockId, claim.id);
  }

  return {
    blockToFactIds,
    factToIntentIds,
    intentToQuestionIds,
    factToEvidenceIds,
    blockToIrClaimIds,
  };
}

/**
 * Narrow invalidation from dirty blocks.
 * Rule: dirty block ⇏ dirty intent automatically — intent only if a supporting
 * fact in the dirty set is its sole support or the heading block itself is dirty.
 */
export function buildInvalidationGraph(
  model: CanonicalContentModel,
  dirtyBlockIds: readonly string[],
): InvalidationGraph {
  const deps = getDependencyGraph(model);
  const dirtyBlocks = new Set(dirtyBlockIds);
  const dirtyNodeIds = new Set<string>();
  const dirtyCandidateIds = new Set<string>();

  for (const blockId of dirtyBlocks) {
    for (const factId of deps.blockToFactIds[blockId] ?? []) {
      dirtyNodeIds.add(factId);
      for (const evId of deps.factToEvidenceIds[factId] ?? []) {
        dirtyNodeIds.add(evId);
      }
    }
    for (const claimId of deps.blockToIrClaimIds[blockId] ?? []) {
      dirtyCandidateIds.add(claimId);
    }
  }

  // Heading blocks dirty → intent nodes for those blocks
  for (const intent of model.knowledge.graph.nodes) {
    if (!isIntentNode(intent)) continue;
    const intentBlocks = model.ir.candidates
      .filter((c) => c.kind === 'intent' && c.id === intent.id)
      .flatMap((c) => c.blockIds);
    if (intentBlocks.some((b) => dirtyBlocks.has(b))) {
      dirtyNodeIds.add(intent.id);
    }
  }

  // Intent dirty only if supporting fact membership in dirty set would change:
  // sole supporting fact is dirty → invalidate intent
  for (const [factId, intentIds] of Object.entries(deps.factToIntentIds)) {
    if (!dirtyNodeIds.has(factId)) continue;
    for (const intentId of intentIds) {
      const supporters = Object.entries(deps.factToIntentIds)
        .filter(([, ids]) => ids.includes(intentId))
        .map(([fid]) => fid);
      if (supporters.length <= 1) dirtyNodeIds.add(intentId);
    }
  }

  const dirtyPassIds: CompilerStageId[] = [];
  if (dirtyBlocks.size > 0) dirtyPassIds.push('entity', 'fact', 'evidence', 'intent');
  const q = graphQuery(model);
  if (
    [...dirtyNodeIds].some((id) => {
      const n = q.node(id);
      return n?.kind === 'intent';
    }) ||
    model.ast.blocks.some((b) => b.type === 'heading' && dirtyBlocks.has(b.blockId))
  ) {
    dirtyPassIds.push('intent');
  }

  const dirtyProjectionIds =
    dirtyNodeIds.size > 0 ? ['coverage', 'action_graph'] : [];

  return {
    dirtyBlockIds: [...dirtyBlocks],
    dirtyCandidateIds: [...dirtyCandidateIds],
    dirtyNodeIds: [...dirtyNodeIds],
    dirtyPassIds,
    dirtyProjectionIds,
  };
}
