import type { CanonicalContentModel } from '../ccm/types/ccm';
import type { CoverageView } from '../projections/coverageView';
import type { VisibilityProjection } from '../projections/visibilityView';
import type { BenchmarkReport } from './benchmark';
import type { JudgeVerdict } from './judge';
import type {
  ConsumerContext,
  ConsumerResult,
  ContentConsumer,
} from './consumerContext';

export type WiDimension = {
  readonly key: string;
  readonly score: number;
  readonly notes: readonly string[];
};

/** Writing Intelligence scorecard — meta-consumer over CCM + peerResults. */
export type WiScorecard = {
  readonly overall: number;
  readonly dimensions: readonly WiDimension[];
  readonly usedPeerResults: readonly string[];
};

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function scoreFromModel(model: CanonicalContentModel): WiDimension[] {
  const { presentation, structure } = model;
  const flow = clamp01(presentation.rhetoric.argumentFlowScore);
  const opening = presentation.rhetoric.problemFirstOpening
    ? 0.85
    : presentation.rhetoric.encyclopedicLead
      ? 0.45
      : 0.55;
  const structureScore =
    (structure.hasSummary ? 0.35 : 0) +
    (structure.hasFaq ? 0.25 : 0) +
    (structure.answersMainQuestionEarly ? 0.4 : 0.15);
  const style =
    presentation.style.avgSentenceLen !== undefined
      ? clamp01(1 - Math.abs(presentation.style.avgSentenceLen - 18) / 30)
      : 0.5;

  return [
    {
      key: 'clarity',
      score: Math.round(opening * 1000) / 1000,
      notes: [
        presentation.rhetoric.problemFirstOpening ? 'problem-first' : 'not problem-first',
        presentation.rhetoric.encyclopedicLead ? 'encyclopedic lead' : 'non-encyclopedic',
      ],
    },
    {
      key: 'flow',
      score: Math.round(flow * 1000) / 1000,
      notes: [`argumentFlowScore=${presentation.rhetoric.argumentFlowScore}`],
    },
    {
      key: 'structure',
      score: Math.round(clamp01(structureScore) * 1000) / 1000,
      notes: [
        `hasSummary=${structure.hasSummary}`,
        `hasFaq=${structure.hasFaq}`,
        `answersEarly=${structure.answersMainQuestionEarly}`,
      ],
    },
    {
      key: 'style',
      score: Math.round(style * 1000) / 1000,
      notes: presentation.style.avgSentenceLen
        ? [`avgSentenceLen=${presentation.style.avgSentenceLen}`]
        : ['style signals sparse'],
    },
  ];
}

function asCoverage(v: unknown): CoverageView | null {
  if (!v || typeof v !== 'object') return null;
  if (!('overall' in v) || typeof (v as CoverageView).overall !== 'number') return null;
  return v as CoverageView;
}

function asVisibility(v: unknown): VisibilityProjection | null {
  if (!v || typeof v !== 'object') return null;
  if (!('completeness' in v)) return null;
  return v as VisibilityProjection;
}

function asBenchmark(v: unknown): BenchmarkReport | null {
  if (!v || typeof v !== 'object') return null;
  if (!('completeness' in v) || !('gaps' in v)) return null;
  return v as BenchmarkReport;
}

function asJudge(v: unknown): JudgeVerdict | null {
  if (!v || typeof v !== 'object') return null;
  if (!('verdict' in v)) return null;
  return v as JudgeVerdict;
}

/** Build WiScorecard from CCM presentation/structure + optional peerResults. No re-extract. */
export function buildWiScorecard(context: ConsumerContext): WiScorecard {
  const dimensions = [...scoreFromModel(context.model)];
  const usedPeerResults: string[] = [];
  const peers = context.peerResults;

  const cov = asCoverage(peers?.coverage);
  if (cov) {
    usedPeerResults.push('coverage');
    dimensions.push({
      key: 'peer_coverage',
      score: clamp01(cov.overall),
      notes: [`coverage.overall=${cov.overall}`],
    });
  }

  const vis = asVisibility(peers?.visibility);
  if (vis) {
    usedPeerResults.push('visibility');
    dimensions.push({
      key: 'peer_visibility',
      score: clamp01(vis.completeness),
      notes: [`visibility.completeness=${vis.completeness}`],
    });
  }

  const bench = asBenchmark(peers?.benchmark);
  if (bench) {
    usedPeerResults.push('benchmark');
    dimensions.push({
      key: 'peer_benchmark',
      score: clamp01(bench.completeness),
      notes: [`gaps=${bench.gaps.length}`],
    });
  }

  const judge = asJudge(peers?.judge);
  if (judge) {
    usedPeerResults.push('judge');
    const score =
      judge.verdict === 'improved'
        ? 0.9
        : judge.verdict === 'unchanged'
          ? 0.7
          : judge.verdict === 'mixed'
            ? 0.5
            : 0.3;
    dimensions.push({
      key: 'peer_judge',
      score,
      notes: [`verdict=${judge.verdict}`],
    });
  }

  const overall =
    dimensions.length === 0
      ? 0
      : Math.round(
          (dimensions.reduce((s, d) => s + d.score, 0) / dimensions.length) * 1000,
        ) / 1000;

  return { overall, dimensions, usedPeerResults };
}

export const writingIntelligenceConsumer: ContentConsumer<WiScorecard> = {
  id: 'writing_intelligence',
  accept(context: ConsumerContext): ConsumerResult<WiScorecard> {
    context.runtime.graphQuery(context.model);
    const result = buildWiScorecard(context);
    return {
      consumerId: 'writing_intelligence',
      fromCcmVersion: context.model.version,
      confidence: result.overall,
      result,
      trace: {
        notes: [
          `dims=${result.dimensions.length}`,
          `peers=${result.usedPeerResults.join(',') || 'none'}`,
        ],
      },
    };
  },
};

export type EditorialScorecard = {
  readonly publishReady: boolean;
  readonly eeatHints: readonly string[];
  readonly overall: number;
};

export const editorialIntelligenceConsumer: ContentConsumer<EditorialScorecard> = {
  id: 'editorial_intelligence',
  accept(context: ConsumerContext): ConsumerResult<EditorialScorecard> {
    const m = context.model;
    const eeatHints: string[] = [];
    if (!m.structure.hasSummary) eeatHints.push('add summary for editorial close');
    if (m.compiler.partial) eeatHints.push('compile was partial');
    if (m.compiler.confidence < 0.5) eeatHints.push('low compiler confidence');
    const publishReady =
      !m.compiler.partial && eeatHints.length === 0 && m.ast.blocks.length > 0;
    const overall = publishReady ? 0.85 : clamp01(0.4 + m.compiler.confidence * 0.4);
    return {
      consumerId: 'editorial_intelligence',
      fromCcmVersion: m.version,
      confidence: overall,
      result: { publishReady, eeatHints, overall },
    };
  },
};

export type OptimizationScorecard = {
  readonly overall: number;
  readonly coverageDelta?: number;
  readonly visibilityDelta?: number;
  readonly actionCount: number;
  readonly notes: readonly string[];
};

export const optimizationIntelligenceConsumer: ContentConsumer<OptimizationScorecard> = {
  id: 'optimization_intelligence',
  accept(context: ConsumerContext): ConsumerResult<OptimizationScorecard> {
    const notes: string[] = [];
    const cov = asCoverage(context.peerResults?.coverage);
    const vis = asVisibility(context.peerResults?.visibility);
    const actionCount = context.actionGraph?.actions.length ?? 0;
    if (actionCount > 0) notes.push(`open_actions=${actionCount}`);
    const coverageDelta = cov ? cov.overall : undefined;
    const visibilityDelta = vis ? vis.completeness : undefined;
    const parts = [coverageDelta, visibilityDelta].filter(
      (n): n is number => typeof n === 'number',
    );
    const overall =
      parts.length > 0
        ? Math.round((parts.reduce((a, b) => a + b, 0) / parts.length) * 1000) / 1000
        : clamp01(1 - actionCount * 0.05);
    return {
      consumerId: 'optimization_intelligence',
      fromCcmVersion: context.model.version,
      confidence: overall,
      result: { overall, coverageDelta, visibilityDelta, actionCount, notes },
    };
  },
};
