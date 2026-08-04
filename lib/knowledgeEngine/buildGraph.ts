import { KNOWLEDGE_SCHEMA_VERSION } from './constants';
import type {
  CanonicalClaim,
  KnowledgeEntityVote,
  KnowledgeGraph,
  KnowledgeGap,
  CompetitorDocument,
  TopicBlock,
  StageTimingsMs,
  VerifierResult,
  PriorityClass,
} from './types';

export function buildKnowledgeGraph(opts: {
  claims: CanonicalClaim[];
  entities: KnowledgeEntityVote[];
  topicBlocks: TopicBlock[];
  gaps: KnowledgeGap[];
  competitors: CompetitorDocument[];
  stageTimingsMs: StageTimingsMs;
  verifier: VerifierResult;
}): KnowledgeGraph {
  const graph = {
    knowledge_version: KNOWLEDGE_SCHEMA_VERSION,
    claims: Object.freeze(opts.claims.map(freezeClaim)),
    entities: Object.freeze(opts.entities.map((e) => Object.freeze({ ...e }))),
    topicBlocks: Object.freeze(opts.topicBlocks.map((b) => Object.freeze({
      ...b,
      memberHeadings: Object.freeze([...b.memberHeadings]),
      claimIds: Object.freeze([...b.claimIds]),
    }))),
    gaps: Object.freeze(opts.gaps.map((g) => Object.freeze({
      ...g,
      relatedClaimIds: Object.freeze([...g.relatedClaimIds]),
    }))),
    competitors: Object.freeze(opts.competitors.map((d) => Object.freeze({
      ...d,
      headings: Object.freeze([...d.headings]),
      entities: Object.freeze([...d.entities]),
      claimIds: Object.freeze([...d.claimIds]),
      topicBlockIds: Object.freeze([...d.topicBlockIds]),
    }))),
    stageTimingsMs: Object.freeze({ ...opts.stageTimingsMs }),
    verifier: Object.freeze({
      ...opts.verifier,
      issues: Object.freeze([...opts.verifier.issues.map((i) => Object.freeze({ ...i }))]),
    }),
  };
  // Runtime freeze; TS Readonly<> from Object.freeze is stricter than our claim shapes.
  return Object.freeze(graph) as KnowledgeGraph;
}

function freezeClaim(c: CanonicalClaim): CanonicalClaim {
  return Object.freeze({
    ...c,
    evidence: Object.freeze([...c.evidence.map((e) => Object.freeze({ ...e }))]),
    usedInSections: Object.freeze([...c.usedInSections]),
    generatedFrom: Object.freeze([...c.generatedFrom]),
    sourceDiversity: Object.freeze({ ...c.sourceDiversity }),
    consensusExplanation: Object.freeze({
      ...c.consensusExplanation,
      because: Object.freeze([...c.consensusExplanation.because]),
    }),
  }) as CanonicalClaim;
}


export function voteEntities(
  terms: string[],
  docs: CompetitorDocument[],
): KnowledgeEntityVote[] {
  const total = Math.max(1, docs.length);
  const counts = new Map<string, number>();
  for (const t of terms) {
    const k = t.toLowerCase();
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  // heading presence across docs
  for (const d of docs) {
    for (const h of d.headings) {
      const k = h.toLowerCase();
      if (counts.has(k)) continue;
      // soft: count unique heading as 1 doc hit when matching entity term substring
    }
  }

  return [...counts.entries()].map(([term, hit]) => {
    const consensus = Math.min(1, hit / total);
    const importanceScore = Math.round(consensus * 100);
    const importance: PriorityClass =
      importanceScore >= 80 ? 'critical'
        : importanceScore >= 60 ? 'high'
          : importanceScore >= 40 ? 'medium'
            : 'low';
    return {
      term,
      docsHit: hit,
      competitorsTotal: total,
      consensus,
      importance,
      importanceScore,
    };
  }).sort((a, b) => b.consensus - a.consensus).slice(0, 80);
}
