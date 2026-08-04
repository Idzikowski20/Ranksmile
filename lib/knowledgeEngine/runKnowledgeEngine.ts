import { buildCompetitorDocuments } from './competitorDocument';
import { extractRawKnowledge, normalizeCandidates } from './extract';
import { canonicalizeClaims, sentencesToCanonicalizeInputs } from './canonicalize';
import { voteClaims } from './vote';
import { buildTopicBlocks, discoverGaps } from './cluster';
import { buildKnowledgeGraph, voteEntities } from './buildGraph';
import { verifyKnowledgeGraph } from './verify';
import { getEmbeddingProvider } from './embeddingProvider';
import type { KnowledgeGraph, StageTimingsMs } from './types';

export type RunKnowledgeEngineInput = {
  keyword: string;
  outlinesCache?: string | null;
  scoreData?: Record<string, unknown> | null;
  paaQuestions?: string[];
  extraTexts?: Array<{ text: string; url: string; kind?: string }>;
};

export type RunKnowledgeEngineResult = {
  graph: KnowledgeGraph;
  stageTimingsMs: StageTimingsMs;
};

function now(): number {
  return Date.now();
}

/**
 * Knowledge Intelligence only — does not compute structural word/H2 targets
 * (see Benchmark Intelligence).
 */
export async function runKnowledgeEngine(
  input: RunKnowledgeEngineInput,
): Promise<RunKnowledgeEngineResult> {
  const provider = getEmbeddingProvider();
  const timings: StageTimingsMs = {
    extract: 0,
    normalize: 0,
    canonicalize: 0,
    vote: 0,
    cluster: 0,
    build: 0,
    verify: 0,
  };

  let t0 = now();
  const docs = buildCompetitorDocuments({
    outlinesCache: input.outlinesCache,
    scoreData: input.scoreData,
  });
  const raw = extractRawKnowledge({ docs, extraTexts: input.extraTexts });
  timings.extract = now() - t0;

  t0 = now();
  const normalized = normalizeCandidates(raw);
  timings.normalize = now() - t0;

  t0 = now();
  const fromSentences = sentencesToCanonicalizeInputs(normalized.sentences);
  // Soft claims from long headings only (no SEO boilerplate padding)
  const fromHeadings = normalized.headings
    .filter((h) => h.text.trim().length >= 20)
    .slice(0, 40)
    .map((h) => ({
      text: h.text.trim(),
      url: h.url,
      kind: 'competitor' as const,
      serpPosition: h.serpPosition,
    }));
  const inputs = fromSentences.length >= 5 ? fromSentences : [...fromSentences, ...fromHeadings];
  let claims = await canonicalizeClaims(inputs, { provider });
  timings.canonicalize = now() - t0;

  t0 = now();
  claims = voteClaims(claims, docs);
  timings.vote = now() - t0;

  t0 = now();
  const topicBlocks = await buildTopicBlocks({
    headings: normalized.headings,
    claims,
    competitorCount: docs.length,
    provider,
  });
  const gaps = discoverGaps({
    claims,
    topicBlocks,
    paaQuestions: input.paaQuestions,
  });
  timings.cluster = now() - t0;

  t0 = now();
  const entities = voteEntities(normalized.entityCandidates, docs);
  const competitors = docs.map((d) => ({
    ...d,
    claimIds: claims
      .filter((c) => c.evidence.some((e) => e.url === d.url))
      .map((c) => c.id),
    topicBlockIds: topicBlocks
      .filter((b) => b.memberHeadings.some((h) => d.headings.includes(h)))
      .map((b) => b.id),
    entities: normalized.entityCandidates.filter((e) =>
      d.headings.some((h) => h.toLowerCase().includes(e.toLowerCase().slice(0, 12))),
    ).slice(0, 20),
  }));

  // Temporary graph for verify before freeze
  const draft = {
    knowledge_version: 1 as const,
    claims,
    entities,
    topicBlocks,
    gaps,
    competitors,
    stageTimingsMs: timings,
  };
  timings.build = now() - t0;

  t0 = now();
  const verifier = verifyKnowledgeGraph(draft);
  timings.verify = now() - t0;

  const graph = buildKnowledgeGraph({
    ...draft,
    stageTimingsMs: timings,
    verifier,
  });

  return { graph, stageTimingsMs: timings };
}
