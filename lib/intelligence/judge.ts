import type { ActionGraph, EditAction } from '../ccm/types/actionGraph';
import type { CanonicalContentModel } from '../ccm/types/ccm';
import { graphQuery } from '../ccm/graphQuery';
import { isFactNode } from '../ccm/types/graph';
import { diffModels, type ModelDiff } from './modelDiff';
import { projectCoverage } from '../projections/coverageView';

export type ExpectationResult = {
  readonly actionId: string;
  readonly op: string;
  readonly met: boolean;
  readonly detail: string;
};

export type JudgeVerdictKind = 'improved' | 'regressed' | 'unchanged' | 'mixed';

export type JudgeVerdict = {
  readonly verdict: JudgeVerdictKind;
  readonly diff: ModelDiff;
  readonly expectationResults: readonly ExpectationResult[];
  readonly notes: readonly string[];
};

export type JudgeOpts = {
  readonly beforeActions?: ActionGraph;
  readonly afterActions?: ActionGraph;
  /** Actions whose DSL expectations to verify (defaults to beforeActions). */
  readonly appliedActions?: readonly EditAction[];
};

function verifyAction(
  action: EditAction,
  before: CanonicalContentModel,
  after: CanonicalContentModel,
): ExpectationResult {
  const op = action.dsl.op;
  const qBefore = graphQuery(before);
  const qAfter = graphQuery(after);
  if (op === 'STRENGTHEN_EVIDENCE') {
    const factId = action.dsl.factId;
    const beforeFact = qBefore.node(factId);
    const afterFact = qAfter.node(factId);
    const beforeEv = qBefore.neighbors(factId, 'supportedBy', 'out').length;
    const afterEv = qAfter.neighbors(factId, 'supportedBy', 'out').length;
    const met =
      afterEv > beforeEv ||
      (beforeFact &&
        isFactNode(beforeFact) &&
        beforeFact.status === 'weak' &&
        afterFact &&
        isFactNode(afterFact) &&
        afterFact.status === 'covered');
    return {
      actionId: action.id,
      op,
      met: Boolean(met),
      detail: met
        ? `evidence ${beforeEv}→${afterEv}`
        : `no evidence gain for ${factId}`,
    };
  }
  if (op === 'COVER_INTENT') {
    const intentId = action.dsl.intentId;
    const beforeN = qBefore.neighbors(intentId, 'supports', 'in').length;
    const afterN = qAfter.neighbors(intentId, 'supports', 'in').length;
    const met = afterN > beforeN;
    return {
      actionId: action.id,
      op,
      met,
      detail: met ? `facts ${beforeN}→${afterN}` : `intent ${intentId} still uncovered`,
    };
  }
  if (op === 'ADD_FACT') {
    const beforeFacts = new Set(qBefore.findFacts().map((f) => f.statement));
    const added = qAfter.findFacts().filter((n) => !beforeFacts.has(n.statement));
    const met = added.length > 0;
    return {
      actionId: action.id,
      op,
      met,
      detail: met ? `added ${added.length} fact(s)` : 'no new fact statement',
    };
  }
  if (op === 'FIX_STRUCTURE') {
    const kind = action.dsl.kind;
    const met =
      (kind === 'faq' && after.structure.hasFaq && !before.structure.hasFaq) ||
      (kind === 'summary' && after.structure.hasSummary && !before.structure.hasSummary) ||
      kind === 'opening' ||
      kind === 'heading';
    return {
      actionId: action.id,
      op,
      met: Boolean(met),
      detail: met ? `${kind} improved` : `${kind} not reflected in structure slice`,
    };
  }
  return {
    actionId: action.id,
    op,
    met: false,
    detail: 'expectation check not implemented for this op',
  };
}

function classifyVerdict(
  diff: ModelDiff,
  expectations: readonly ExpectationResult[],
): JudgeVerdictKind {
  if (diff.identicalCompile && expectations.length === 0) return 'unchanged';
  if (expectations.length > 0) {
    const met = expectations.filter((e) => e.met).length;
    const failed = expectations.length - met;
    if (met > 0 && failed === 0) return 'improved';
    if (met === 0 && failed > 0) return 'regressed';
    if (met > 0 && failed > 0) return 'mixed';
  }
  const graphGain =
    diff.graphDiff.addedNodeIds.length - diff.graphDiff.removedNodeIds.length;
  const coverageUp = diff.scoreDiff.coverageOverallDelta > 0;
  const coverageDown = diff.scoreDiff.coverageOverallDelta < 0;
  if (diff.identicalCompile) return 'unchanged';
  if (coverageUp || graphGain > 0) return coverageDown ? 'mixed' : 'improved';
  if (coverageDown || graphGain < 0) return 'regressed';
  return 'unchanged';
}

/** Judge: derive ModelDiff + verify Recommendation DSL expectations when provided. */
export function judgeModels(
  before: CanonicalContentModel,
  after: CanonicalContentModel,
  opts: JudgeOpts = {},
): JudgeVerdict {
  const diff = diffModels(before, after, {
    beforeActions: opts.beforeActions,
    afterActions: opts.afterActions,
  });
  const applied = opts.appliedActions ?? opts.beforeActions?.actions ?? [];
  const expectationResults = applied.map((a) => verifyAction(a, before, after));

  const beforeCov = projectCoverage(before);
  const afterCov = projectCoverage(after);
  const notes: string[] = [];
  if (diff.identicalCompile) notes.push('identical deterministicHash');
  notes.push(`coverage ${beforeCov.overall.toFixed(2)}→${afterCov.overall.toFixed(2)}`);
  notes.push(`intents=${graphQuery(after).findIntents().length}`);

  return {
    verdict: classifyVerdict(diff, expectationResults),
    diff: {
      ...diff,
      scoreDiff: {
        contentScoreDelta: afterCov.overall - beforeCov.overall,
        coverageOverallDelta: afterCov.overall - beforeCov.overall,
      },
    },
    expectationResults,
    notes,
  };
}
