import { buildGraphIndexes } from './buildIndexes';
import { computeDeterministicHash } from './deterministicHash';
import type { CanonicalContentModel } from './types/ccm';
import type { ContentProfileId } from './types/status';

export type EmptyCcmOpts = {
  readonly articleId: string;
  readonly contentHash: string;
  /** REQUIRED ISO — caller/clock supplies. Forbidden: new Date() here. */
  readonly compiledAt: string;
  readonly profile?: ContentProfileId;
  readonly ccmId?: string;
  readonly version?: number;
  readonly locale?: string;
  readonly compilerId?: string;
};

const EMPTY_AST = { version: 1 as const, blocks: [] as const };
const EMPTY_SEMANTIC = {
  version: 1 as const,
  claims: [] as const,
  discourse: [] as const,
};

export function createEmptyCcm(opts: EmptyCcmOpts): CanonicalContentModel {
  const profile = opts.profile ?? 'generic';
  const rulesVersion = '0';
  const promptVersion = '0';
  const irVersion = '1';
  const deterministicHash = computeDeterministicHash({
    ast: EMPTY_AST,
    semanticAst: EMPTY_SEMANTIC,
    rulesVersion,
    promptVersion,
    profile,
    irVersion,
  });

  const graph = { nodes: [] as const, edges: [] as const };
  const indexes = buildGraphIndexes(graph.nodes, graph.edges);

  return {
    schemaVersion: 1,
    ccmId: opts.ccmId ?? `ccm_${opts.articleId}`,
    articleId: opts.articleId,
    contentHash: opts.contentHash,
    version: opts.version ?? 1,
    compiledAt: opts.compiledAt,
    profile,
    immutable: true,
    ast: EMPTY_AST,
    semanticAst: EMPTY_SEMANTIC,
    ir: {
      version: 1,
      contentHash: opts.contentHash,
      paragraphs: [],
      claims: [],
      candidates: [],
    },
    knowledge: { graph, indexes },
    structure: {
      sections: [],
      readingOrder: [],
      hasFaq: false,
      hasSummary: false,
      answersMainQuestionEarly: false,
    },
    presentation: {
      rhetoric: {
        argumentFlowScore: 0,
        problemFirstOpening: false,
        encyclopedicLead: false,
      },
      style: {},
      ux: { tocFriendly: false },
    },
    metadata: {
      locale: opts.locale ?? 'pl',
      seo: {},
      ai: {},
    },
    reasoning: { nodes: [], edges: [] },
    metrics: {
      contentScore: 0,
      components: [],
      coverageView: {
        overall: 0,
        coveredFacts: 0,
        totalFacts: 0,
        coveredIntents: 0,
        totalIntents: 0,
      },
      confidence: 0,
    },
    statistics: {
      nodeCounts: {},
      edgeCounts: {},
      orphanNodeIds: [],
      duplicateFactGroupIds: [],
      conflictingFactPairIds: [],
      avgEvidencePerFact: 0,
    },
    references: { citations: [] },
    embeddings: null,
    compiler: {
      compilerId: opts.compilerId ?? 'cia-v1',
      compileVersion: '0',
      promptVersion,
      rulesVersion,
      embeddingVersion: null,
      irVersion,
      modelVersions: {},
      profileId: profile,
      mode: 'full',
      partial: false,
      failedStages: [],
      capabilities: {
        incremental: false,
        wikidata: false,
        embeddings: false,
        citations: false,
        reasoning: false,
        planner: true,
        ir: true,
      },
      deterministicHash,
      compileDurationMs: 0,
      tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      cost: { currency: 'USD', amount: 0 },
      confidence: 0,
      notes: ['empty'],
    },
  };
}
