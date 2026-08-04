import type { ContentProfileId } from './status';

export type CompilerStageId =
  | 'lexer'
  | 'parser'
  | 'normalizer'
  | 'semantic'
  | 'ir'
  | 'entity'
  | 'fact'
  | 'relation'
  | 'intent'
  | 'question'
  | 'evidence'
  | 'graph_builder'
  | 'validator'
  | 'aggregator'
  | 'embeddings';

export interface CompilerCapabilities {
  readonly incremental: boolean;
  readonly wikidata: boolean;
  readonly embeddings: boolean;
  readonly citations: boolean;
  readonly reasoning: boolean;
  readonly planner: boolean;
  readonly ir: boolean;
}

export interface TokenUsage {
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly totalTokens: number;
}

export interface CostEstimate {
  readonly currency: 'USD';
  readonly amount: number;
  readonly breakdown?: Readonly<Record<string, number>>;
}

export interface CompilerMetadata {
  readonly compilerId: string;
  readonly compileVersion: string;
  readonly promptVersion: string;
  readonly rulesVersion: string;
  readonly embeddingVersion: string | null;
  readonly irVersion: string;
  readonly modelVersions: Readonly<Record<string, string>>;
  readonly profileId: ContentProfileId;
  readonly mode: 'full' | 'incremental' | 'adapter';
  readonly partial: boolean;
  readonly failedStages: readonly CompilerStageId[];
  readonly capabilities: CompilerCapabilities;
  readonly deterministicHash: string;
  readonly compileDurationMs: number;
  readonly tokenUsage: TokenUsage;
  readonly cost: CostEstimate;
  readonly confidence: number;
  readonly notes: readonly string[];
  readonly stagePromptVersions?: Readonly<Record<string, string>>;
}
