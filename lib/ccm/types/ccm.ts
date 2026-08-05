import type { LexicalAst, SemanticAst } from './ast';
import type { CompilerMetadata } from './compilerMeta';
import type { KnowledgeGraph, GraphIndexes } from './graph';
import type { ContentIr } from './ir';
import type { ReasoningGraph } from './reasoning';
import type {
  ContentMetadata,
  ContentMetrics,
  ContentStatistics,
  EmbeddingIndex,
  LegacyBridge,
  PresentationSlice,
  ReferenceIndex,
  StructureSlice,
} from './slices';
import type { ContentProfileId } from './status';

export type CcmSchemaVersion = 1;

export interface KnowledgeSlice {
  readonly graph: KnowledgeGraph;
  readonly indexes: GraphIndexes;
}

export interface CanonicalContentModel {
  readonly schemaVersion: CcmSchemaVersion;
  readonly ccmId: string;
  readonly articleId: string;
  readonly contentHash: string;
  readonly version: number;
  readonly compiledAt: string;
  readonly profile: ContentProfileId;
  readonly immutable: true;
  readonly ast: LexicalAst;
  readonly semanticAst: SemanticAst;
  readonly ir: ContentIr;
  readonly knowledge: KnowledgeSlice;
  readonly structure: StructureSlice;
  readonly presentation: PresentationSlice;
  readonly metadata: ContentMetadata;
  readonly reasoning: ReasoningGraph;
  readonly metrics: ContentMetrics;
  readonly statistics: ContentStatistics;
  readonly references: ReferenceIndex;
  readonly embeddings: EmbeddingIndex | null;
  readonly compiler: CompilerMetadata;
  readonly legacy?: LegacyBridge;
}
