/**
 * CCM wire format: GraphIndexes ReadonlyMaps serialize as sorted [key, value][] entries.
 * parseCcm rebuilds ReadonlyMap instances.
 */
import type { CanonicalContentModel } from './types/ccm';
import type { GraphIndexes, KgEdge, KgNode } from './types/graph';
import type {
  ContentMetadata,
  ContentMetrics,
  ContentStatistics,
  PresentationSlice,
  ReferenceIndex,
  StructureSlice,
} from './types/slices';
import type { CompilerMetadata } from './types/compilerMeta';
import type { ReasoningGraph } from './types/reasoning';
import type { ContentIr } from './types/ir';
import type { LexicalAst, SemanticAst } from './types/ast';
import { ccmWireSchema, type CcmWire } from './ccmSchema';
import { canonicalJsonStringify } from './canonicalJson';

function mapToSortedEntries<V>(map: ReadonlyMap<string, V>): Array<[string, V]> {
  return [...map.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}

function entriesToMap<V>(entries: ReadonlyArray<readonly [string, V]>): ReadonlyMap<string, V> {
  return new Map(entries);
}

function indexesToWire(indexes: GraphIndexes): CcmWire['knowledge']['indexes'] {
  return {
    byId: mapToSortedEntries(indexes.byId) as CcmWire['knowledge']['indexes']['byId'],
    entityByCanonical: mapToSortedEntries(indexes.entityByCanonical),
    factsByEntityId: mapToSortedEntries(indexes.factsByEntityId).map(([k, v]) => [k, [...v]]),
    factsByIntentId: mapToSortedEntries(indexes.factsByIntentId).map(([k, v]) => [k, [...v]]),
    questionsByIntentId: mapToSortedEntries(indexes.questionsByIntentId).map(([k, v]) => [
      k,
      [...v],
    ]),
    intentsByParentId: mapToSortedEntries(indexes.intentsByParentId).map(([k, v]) => [k, [...v]]),
    evidenceByFactId: mapToSortedEntries(indexes.evidenceByFactId).map(([k, v]) => [k, [...v]]),
    edgesByFrom: mapToSortedEntries(indexes.edgesByFrom).map(([k, v]) => [k, [...v]]),
    edgesByTo: mapToSortedEntries(indexes.edgesByTo).map(([k, v]) => [k, [...v]]),
    edgesByType: mapToSortedEntries(indexes.edgesByType).map(([k, v]) => [k, [...v]]),
  };
}

function indexesFromWire(wire: CcmWire['knowledge']['indexes']): GraphIndexes {
  return {
    byId: entriesToMap(wire.byId) as ReadonlyMap<string, KgNode>,
    entityByCanonical: entriesToMap(wire.entityByCanonical),
    factsByEntityId: entriesToMap(wire.factsByEntityId),
    factsByIntentId: entriesToMap(wire.factsByIntentId),
    questionsByIntentId: entriesToMap(wire.questionsByIntentId),
    intentsByParentId: entriesToMap(wire.intentsByParentId),
    evidenceByFactId: entriesToMap(wire.evidenceByFactId),
    edgesByFrom: entriesToMap(wire.edgesByFrom),
    edgesByTo: entriesToMap(wire.edgesByTo),
    edgesByType: entriesToMap(wire.edgesByType),
  };
}

export function toCcmWire(ccm: CanonicalContentModel): CcmWire {
  return {
    schemaVersion: 1,
    ccmId: ccm.ccmId,
    articleId: ccm.articleId,
    contentHash: ccm.contentHash,
    version: ccm.version,
    compiledAt: ccm.compiledAt,
    profile: ccm.profile,
    immutable: true,
    ast: ccm.ast as unknown as CcmWire['ast'],
    semanticAst: ccm.semanticAst as unknown as CcmWire['semanticAst'],
    ir: ccm.ir as unknown as CcmWire['ir'],
    knowledge: {
      graph: {
        nodes: [...ccm.knowledge.graph.nodes] as CcmWire['knowledge']['graph']['nodes'],
        edges: [...ccm.knowledge.graph.edges],
      },
      indexes: indexesToWire(ccm.knowledge.indexes),
    },
    structure: ccm.structure as unknown as Record<string, unknown>,
    presentation: ccm.presentation as unknown as Record<string, unknown>,
    metadata: ccm.metadata as unknown as Record<string, unknown>,
    reasoning: {
      nodes: [...ccm.reasoning.nodes] as unknown as CcmWire['reasoning']['nodes'],
      edges: [...ccm.reasoning.edges] as unknown as CcmWire['reasoning']['edges'],
    },
    metrics: ccm.metrics as unknown as Record<string, unknown>,
    statistics: ccm.statistics as unknown as Record<string, unknown>,
    references: ccm.references as unknown as Record<string, unknown>,
    embeddings: ccm.embeddings,
    compiler: ccm.compiler as unknown as CcmWire['compiler'],
    ...(ccm.legacy ? { legacy: ccm.legacy as unknown as Record<string, unknown> } : {}),
  };
}

export function serializeCcm(ccm: CanonicalContentModel): string {
  return canonicalJsonStringify(toCcmWire(ccm));
}

function wireToCcm(wire: CcmWire): CanonicalContentModel {
  return {
    schemaVersion: 1,
    ccmId: wire.ccmId,
    articleId: wire.articleId,
    contentHash: wire.contentHash,
    version: wire.version,
    compiledAt: wire.compiledAt,
    profile: wire.profile,
    immutable: true,
    ast: wire.ast as unknown as LexicalAst,
    semanticAst: wire.semanticAst as unknown as SemanticAst,
    ir: wire.ir as unknown as ContentIr,
    knowledge: {
      graph: {
        nodes: wire.knowledge.graph.nodes as unknown as readonly KgNode[],
        edges: wire.knowledge.graph.edges as unknown as readonly KgEdge[],
      },
      indexes: indexesFromWire(wire.knowledge.indexes),
    },
    structure: wire.structure as unknown as StructureSlice,
    presentation: wire.presentation as unknown as PresentationSlice,
    metadata: wire.metadata as unknown as ContentMetadata,
    reasoning: wire.reasoning as unknown as ReasoningGraph,
    metrics: wire.metrics as unknown as ContentMetrics,
    statistics: wire.statistics as unknown as ContentStatistics,
    references: wire.references as unknown as ReferenceIndex,
    embeddings: wire.embeddings as CanonicalContentModel['embeddings'],
    compiler: wire.compiler as unknown as CompilerMetadata,
    ...(wire.legacy
      ? { legacy: wire.legacy as unknown as CanonicalContentModel['legacy'] }
      : {}),
  };
}

/** Parse wire JSON → CCM. Returns null on zod failure. */
export function parseCcm(json: string): CanonicalContentModel | null {
  let raw: unknown;
  try {
    raw = JSON.parse(json) as unknown;
  } catch {
    return null;
  }
  const parsed = ccmWireSchema.safeParse(raw);
  if (!parsed.success) return null;
  return wireToCcm(parsed.data);
}
