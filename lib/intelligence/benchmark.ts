import { graphQuery, type SubgraphMatch, type SubgraphPattern } from '../ccm/graphQuery';
import type { RecommendationOp } from '../ccm/types/recommendationDsl';
import type { CanonicalContentModel } from '../ccm/types/ccm';
import { isFactNode } from '../ccm/types/graph';
import type { ConsumerContext, ConsumerResult, ContentConsumer } from './consumerContext';

export type BenchmarkGap = {
  readonly patternId: string;
  readonly missingRoles: readonly string[];
  readonly nodeIds: readonly string[];
  readonly recommendation: RecommendationOp;
};

export type BenchmarkReport = {
  readonly completeness: number;
  readonly matches: readonly SubgraphMatch[];
  readonly gaps: readonly BenchmarkGap[];
  readonly competitorCcmVersion?: number;
  readonly patternsChecked: number;
};

/** Default motifs: Fact→Evidence; Fact→Entity. */
export const DEFAULT_BENCHMARK_PATTERNS: readonly {
  readonly id: string;
  readonly pattern: SubgraphPattern;
}[] = [
  {
    id: 'fact_has_evidence',
    pattern: { rootKind: 'fact', edgePath: ['supportedBy'] },
  },
  {
    id: 'fact_uses_entity',
    pattern: { rootKind: 'fact', edgePath: ['uses'] },
  },
];

function gapToRecommendation(
  patternId: string,
  match: SubgraphMatch,
): RecommendationOp {
  const rootId = match.nodeIds[0] ?? 'unknown';
  if (patternId === 'fact_has_evidence') {
    return {
      op: 'STRENGTHEN_EVIDENCE',
      factId: rootId,
      expected: {
        expectedVisibilityDelta: 0.05,
        expectedReasoning: 'Benchmark: fact missing supportedBy evidence',
      },
    };
  }
  return {
    op: 'COVER_INTENT',
    intentId: rootId,
    expected: {
      expectedVisibilityDelta: 0.05,
      expectedReasoning: `Benchmark gap: ${patternId}`,
    },
  };
}

/**
 * Benchmark via findSubgraph — gaps where missingRoles non-empty.
 * Never parses HTML when CCM available.
 */
export function runBenchmark(
  subject: CanonicalContentModel,
  opts: {
    readonly competitor?: CanonicalContentModel;
    readonly patterns?: typeof DEFAULT_BENCHMARK_PATTERNS;
  } = {},
): BenchmarkReport {
  const patterns = opts.patterns ?? DEFAULT_BENCHMARK_PATTERNS;
  const sq = graphQuery(subject);
  const matches: SubgraphMatch[] = [];
  const gaps: BenchmarkGap[] = [];

  for (const { id, pattern } of patterns) {
    const found = sq.findSubgraph(pattern);
    for (const m of found) {
      matches.push(m);
      if (m.missingRoles.length === 0) continue;
      const root = sq.node(m.nodeIds[0] ?? '');
      if (root && isFactNode(root)) {
        gaps.push({
          patternId: id,
          missingRoles: m.missingRoles,
          nodeIds: m.nodeIds,
          recommendation: gapToRecommendation(id, m),
        });
      }
    }
  }

  for (const intent of sq.findIntents()) {
    const supporters = sq.neighbors(intent.id, 'supports', 'in');
    if (supporters.length === 0) {
      gaps.push({
        patternId: 'intent_has_fact',
        missingRoles: ['supports'],
        nodeIds: [intent.id],
        recommendation: {
          op: 'COVER_INTENT',
          intentId: intent.id,
          expected: {
            expectedVisibilityDelta: 0.1,
            expectedReasoning: 'Benchmark: intent has no supporting facts',
          },
        },
      });
    }
  }

  let competitorBonus = 0;
  if (opts.competitor) {
    const cq = graphQuery(opts.competitor);
    for (const { pattern } of patterns) {
      const compOk = cq.findSubgraph(pattern).filter((m) => m.missingRoles.length === 0).length;
      const subOk = sq.findSubgraph(pattern).filter((m) => m.missingRoles.length === 0).length;
      if (compOk > subOk) competitorBonus += compOk - subOk;
    }
  }

  const completeMatches = matches.filter((m) => m.missingRoles.length === 0).length;
  const base =
    matches.length === 0
      ? gaps.length === 0
        ? 1
        : 0
      : completeMatches / matches.length;
  const completeness = Math.round(Math.max(0, base - competitorBonus * 0.02) * 1000) / 1000;

  return {
    completeness,
    matches,
    gaps,
    competitorCcmVersion: opts.competitor?.version,
    patternsChecked: patterns.length,
  };
}

export const benchmarkConsumer: ContentConsumer<BenchmarkReport> = {
  id: 'benchmark',
  accept(context: ConsumerContext): ConsumerResult<BenchmarkReport> {
    const peer = context.peerResults?.benchmark;
    const competitor =
      peer && typeof peer === 'object' && peer !== null && 'knowledge' in peer
        ? (peer as CanonicalContentModel)
        : undefined;
    const result = runBenchmark(context.model, {
      competitor,
    });
    // Touch runtime.graphQuery to enforce ConsumerContext contract
    context.runtime.graphQuery(context.model);
    return {
      consumerId: 'benchmark',
      fromCcmVersion: context.model.version,
      confidence: result.completeness,
      result,
      trace: { notes: [`gaps=${result.gaps.length}`, `matches=${result.matches.length}`] },
    };
  },
};
