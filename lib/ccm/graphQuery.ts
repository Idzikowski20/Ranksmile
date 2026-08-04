import type { CanonicalContentModel } from './types/ccm';
import type { CoverageStatus } from './types/status';
import type {
  EntityNode,
  FactNode,
  IntentNode,
  KgEdgeType,
  KgNode,
  KgNodeKind,
  QuestionNode,
} from './types/graph';
import { isEntityNode, isFactNode, isIntentNode } from './types/graph';

export type FactFilter = {
  readonly status?: CoverageStatus | readonly CoverageStatus[];
  readonly hasEvidence?: boolean;
  readonly sectionId?: string;
};

export type EntityFilter = {
  readonly canonicalName?: string;
};

export type IntentFilter = {
  readonly primary?: boolean;
};

export type QuestionFilter = {
  readonly status?: CoverageStatus;
};

export type TraverseOpts = {
  readonly edgeTypes?: readonly KgEdgeType[];
  readonly direction?: 'out' | 'in' | 'both';
  readonly maxDepth?: number;
};

export type SubgraphPattern = {
  readonly rootKind: KgNodeKind;
  readonly edgePath: readonly KgEdgeType[];
  readonly requiredStatuses?: readonly CoverageStatus[];
};

export type SubgraphMatch = {
  readonly nodeIds: readonly string[];
  readonly edgeIds: readonly string[];
  readonly missingRoles: readonly string[];
};

export type ReasoningPath = {
  readonly nodeIds: readonly string[];
  readonly edgeIds: readonly string[];
  readonly confidence: number;
  readonly summaries: readonly string[];
};

export type GraphQuery = {
  findFacts(filter?: FactFilter): readonly FactNode[];
  findEntities(filter?: EntityFilter): readonly EntityNode[];
  findIntents(filter?: IntentFilter): readonly IntentNode[];
  findQuestions(filter?: QuestionFilter): readonly QuestionNode[];
  node(id: string): KgNode | undefined;
  neighbors(
    id: string,
    edgeType?: KgEdgeType,
    dir?: 'out' | 'in' | 'both',
  ): readonly KgNode[];
  traverse(startId: string, opts?: TraverseOpts): readonly string[];
  findSubgraph(pattern: SubgraphPattern): readonly SubgraphMatch[];
  explain(nodeId: string): ReasoningPath;
};

function statusMatch(
  status: CoverageStatus,
  filter?: CoverageStatus | readonly CoverageStatus[],
): boolean {
  if (filter === undefined) return true;
  return Array.isArray(filter) ? filter.includes(status) : filter === status;
}

/** Official consumer access to KG — indexes are an implementation detail. */
export function graphQuery(model: CanonicalContentModel): GraphQuery {
  const { graph, indexes } = model.knowledge;
  const edges = graph.edges;

  function node(id: string): KgNode | undefined {
    return indexes.byId.get(id);
  }

  function neighbors(
    id: string,
    edgeType?: KgEdgeType,
    dir: 'out' | 'in' | 'both' = 'both',
  ): readonly KgNode[] {
    const out: KgNode[] = [];
    const seen = new Set<string>();
    for (const e of edges) {
      if (edgeType && e.type !== edgeType) continue;
      let other: string | undefined;
      if ((dir === 'out' || dir === 'both') && e.from === id) other = e.to;
      if ((dir === 'in' || dir === 'both') && e.to === id) other = e.from;
      if (!other || seen.has(other)) continue;
      const n = node(other);
      if (!n) continue;
      seen.add(other);
      out.push(n);
    }
    return out;
  }

  function findFacts(filter?: FactFilter): readonly FactNode[] {
    return graph.nodes.filter((n): n is FactNode => {
      if (!isFactNode(n)) return false;
      if (!statusMatch(n.status, filter?.status)) return false;
      if (filter?.sectionId && n.sectionId !== filter.sectionId) return false;
      if (filter?.hasEvidence !== undefined) {
        const has = (indexes.evidenceByFactId.get(n.id)?.length ?? 0) > 0;
        if (has !== filter.hasEvidence) return false;
      }
      return true;
    });
  }

  function findEntities(filter?: EntityFilter): readonly EntityNode[] {
    return graph.nodes.filter((n): n is EntityNode => {
      if (!isEntityNode(n)) return false;
      if (
        filter?.canonicalName &&
        n.canonicalName.toLocaleLowerCase('pl') !==
          filter.canonicalName.toLocaleLowerCase('pl')
      ) {
        return false;
      }
      return true;
    });
  }

  function findIntents(filter?: IntentFilter): readonly IntentNode[] {
    return graph.nodes.filter((n): n is IntentNode => {
      if (!isIntentNode(n)) return false;
      if (filter?.primary !== undefined && n.primary !== filter.primary) return false;
      return true;
    });
  }

  function findQuestions(filter?: QuestionFilter): readonly QuestionNode[] {
    return graph.nodes.filter((n): n is QuestionNode => {
      if (n.kind !== 'question') return false;
      if (!statusMatch(n.status, filter?.status)) return false;
      return true;
    });
  }

  function traverse(startId: string, opts: TraverseOpts = {}): readonly string[] {
    const maxDepth = opts.maxDepth ?? 8;
    const direction = opts.direction ?? 'out';
    const allowed = opts.edgeTypes ? new Set(opts.edgeTypes) : null;
    const visited = new Set<string>();
    const order: string[] = [];
    const queue: Array<{ id: string; depth: number }> = [{ id: startId, depth: 0 }];
    while (queue.length > 0) {
      const cur = queue.shift();
      if (!cur || visited.has(cur.id)) continue;
      visited.add(cur.id);
      order.push(cur.id);
      if (cur.depth >= maxDepth) continue;
      for (const e of edges) {
        if (allowed && !allowed.has(e.type)) continue;
        let next: string | undefined;
        if ((direction === 'out' || direction === 'both') && e.from === cur.id) next = e.to;
        if ((direction === 'in' || direction === 'both') && e.to === cur.id) next = e.from;
        if (next && !visited.has(next)) queue.push({ id: next, depth: cur.depth + 1 });
      }
    }
    return order;
  }

  function findSubgraph(pattern: SubgraphPattern): readonly SubgraphMatch[] {
    const roots = graph.nodes.filter((n) => n.kind === pattern.rootKind);
    const matches: SubgraphMatch[] = [];
    for (const root of roots) {
      if (
        pattern.requiredStatuses &&
        'status' in root &&
        !pattern.requiredStatuses.includes(root.status as CoverageStatus)
      ) {
        continue;
      }
      let frontier: Array<{ nodeId: string; edgeIds: string[]; nodeIds: string[] }> = [
        { nodeId: root.id, edgeIds: [], nodeIds: [root.id] },
      ];
      for (const edgeType of pattern.edgePath) {
        const nextFrontier: typeof frontier = [];
        for (const path of frontier) {
          let stepped = false;
          for (const e of edges) {
            if (e.type !== edgeType || e.from !== path.nodeId) continue;
            stepped = true;
            nextFrontier.push({
              nodeId: e.to,
              edgeIds: [...path.edgeIds, e.id],
              nodeIds: [...path.nodeIds, e.to],
            });
          }
          if (!stepped) {
            matches.push({
              nodeIds: path.nodeIds,
              edgeIds: path.edgeIds,
              missingRoles: [edgeType],
            });
          }
        }
        frontier = nextFrontier;
      }
      for (const path of frontier) {
        matches.push({
          nodeIds: path.nodeIds,
          edgeIds: path.edgeIds,
          missingRoles: [],
        });
      }
    }
    return matches;
  }

  function explain(nodeId: string): ReasoningPath {
    const reasoning = model.reasoning;
    const related = reasoning.nodes.filter((n) => n.refId === nodeId || n.id === nodeId);
    if (related.length === 0) {
      const kg = node(nodeId);
      return {
        nodeIds: kg ? [nodeId] : [],
        edgeIds: [],
        confidence: kg && 'confidence' in kg ? kg.confidence : 0,
        summaries: kg ? [`kg:${kg.kind}`] : [],
      };
    }
    const ids = new Set(related.map((n) => n.id));
    const edgeIds = reasoning.edges
      .filter((e) => ids.has(e.from) || ids.has(e.to))
      .map((e) => e.id);
    const confidence =
      related.reduce((s, n) => s + n.confidence, 0) / Math.max(related.length, 1);
    return {
      nodeIds: [...ids],
      edgeIds,
      confidence,
      summaries: related.map((n) => n.summary),
    };
  }

  return {
    findFacts,
    findEntities,
    findIntents,
    findQuestions,
    node,
    neighbors,
    traverse,
    findSubgraph,
    explain,
  };
}
