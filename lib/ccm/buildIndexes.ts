import type { EntityNode, GraphIndexes, KgEdge, KgNode } from './types/graph';
import { isEntityNode, isEvidenceSpanNode, isFactNode } from './types/graph';

function pushMapList(map: Map<string, string[]>, key: string, id: string): void {
  const list = map.get(key);
  if (list) list.push(id);
  else map.set(key, [id]);
}

function freezeStringLists(map: Map<string, string[]>): ReadonlyMap<string, readonly string[]> {
  const out = new Map<string, readonly string[]>();
  for (const [k, v] of map) out.set(k, Object.freeze([...v]));
  return out;
}

/**
 * Build ReadonlyMap indexes and validate integrity.
 * Throws on duplicate entity canonical, dangling edges, orphan evidence_span.
 */
export function buildGraphIndexes(
  nodes: readonly KgNode[],
  edges: readonly KgEdge[],
): GraphIndexes {
  const byId = new Map<string, KgNode>();
  for (const n of nodes) {
    if (byId.has(n.id)) {
      throw new Error(`buildGraphIndexes: duplicate node id ${n.id}`);
    }
    byId.set(n.id, n);
  }

  const entityByCanonical = new Map<string, string>();
  for (const n of nodes) {
    if (!isEntityNode(n)) continue;
    const ent = n as EntityNode;
    if (entityByCanonical.has(ent.canonicalName)) {
      throw new Error(
        `buildGraphIndexes: duplicate entity canonicalName ${ent.canonicalName}`,
      );
    }
    entityByCanonical.set(ent.canonicalName, ent.id);
  }

  for (const e of edges) {
    if (!byId.has(e.from)) {
      throw new Error(`buildGraphIndexes: edge.from missing from byId: ${e.from}`);
    }
    if (!byId.has(e.to)) {
      throw new Error(`buildGraphIndexes: edge.to missing from byId: ${e.to}`);
    }
  }

  const factsByEntityId = new Map<string, string[]>();
  const factsByIntentId = new Map<string, string[]>();
  const questionsByIntentId = new Map<string, string[]>();
  const intentsByParentId = new Map<string, string[]>();
  const evidenceByFactId = new Map<string, string[]>();
  const edgesByFrom = new Map<string, string[]>();
  const edgesByTo = new Map<string, string[]>();
  const edgesByType = new Map<string, string[]>();

  for (const n of nodes) {
    if (isFactNode(n)) {
      for (const eid of n.entityIds) pushMapList(factsByEntityId, eid, n.id);
    }
    if (n.kind === 'intent' && n.parentId) {
      pushMapList(intentsByParentId, n.parentId, n.id);
    }
  }

  const evidenceWithSupport = new Set<string>();

  for (const e of edges) {
    pushMapList(edgesByFrom, e.from, e.id);
    pushMapList(edgesByTo, e.to, e.id);
    pushMapList(edgesByType, e.type, e.id);

    const fromNode = byId.get(e.from);
    const toNode = byId.get(e.to);
    if (!fromNode || !toNode) continue;

    if (e.type === 'uses' && fromNode.kind === 'fact' && toNode.kind === 'entity') {
      pushMapList(factsByEntityId, toNode.id, fromNode.id);
    }
    if (e.type === 'supports' && fromNode.kind === 'fact' && toNode.kind === 'intent') {
      pushMapList(factsByIntentId, toNode.id, fromNode.id);
    }
    if (e.type === 'answers' && fromNode.kind === 'question' && toNode.kind === 'intent') {
      pushMapList(questionsByIntentId, toNode.id, fromNode.id);
    }
    if (e.type === 'answeredBy' && fromNode.kind === 'intent' && toNode.kind === 'question') {
      pushMapList(questionsByIntentId, fromNode.id, toNode.id);
    }
    if (e.type === 'supportedBy' && fromNode.kind === 'fact' && toNode.kind === 'evidence_span') {
      pushMapList(evidenceByFactId, fromNode.id, toNode.id);
      evidenceWithSupport.add(toNode.id);
    }
  }

  for (const n of nodes) {
    if (isEvidenceSpanNode(n) && !evidenceWithSupport.has(n.id)) {
      throw new Error(`buildGraphIndexes: orphan evidence_span ${n.id}`);
    }
  }

  return {
    byId,
    entityByCanonical,
    factsByEntityId: freezeStringLists(factsByEntityId),
    factsByIntentId: freezeStringLists(factsByIntentId),
    questionsByIntentId: freezeStringLists(questionsByIntentId),
    intentsByParentId: freezeStringLists(intentsByParentId),
    evidenceByFactId: freezeStringLists(evidenceByFactId),
    edgesByFrom: freezeStringLists(edgesByFrom),
    edgesByTo: freezeStringLists(edgesByTo),
    edgesByType: freezeStringLists(edgesByType),
  };
}
