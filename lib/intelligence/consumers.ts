import { projectCoverage, type CoverageView } from '../projections/coverageView';
import {
  projectVisibility,
  type VisibilityProjection,
} from '../projections/visibilityView';
import { buildActionGraph } from '../planner/actionGraphBuilder';
import type { ActionGraph } from '../ccm/types/actionGraph';
import { judgeModels, type JudgeVerdict } from './judge';
import { diffModels } from './modelDiff';
import {
  type ConsumerContext,
  type ConsumerResult,
  type ContentConsumer,
  type SyncContentConsumer,
} from './consumerContext';
import { benchmarkConsumer } from './benchmark';

export const coverageConsumer: SyncContentConsumer<CoverageView> = {
  id: 'coverage_projection',
  accept(context: ConsumerContext): ConsumerResult<CoverageView> {
    if (!context.model.compiler.capabilities.ir) {
      return {
        consumerId: 'coverage_projection',
        fromCcmVersion: context.model.version,
        confidence: 0,
        result: projectCoverage(context.model),
        trace: { notes: ['capabilities.ir=false'] },
      };
    }
    const result = projectCoverage(context.model);
    return {
      consumerId: 'coverage_projection',
      fromCcmVersion: context.model.version,
      confidence: result.overall,
      result,
    };
  },
};

export const visibilityConsumer: SyncContentConsumer<VisibilityProjection> = {
  id: 'visibility_projection',
  accept(context: ConsumerContext): ConsumerResult<VisibilityProjection> {
    const result = projectVisibility(context.model);
    return {
      consumerId: 'visibility_projection',
      fromCcmVersion: context.model.version,
      confidence: result.completeness,
      result,
    };
  },
};

export type ActionGraphBuildResult = ActionGraph;

export const actionGraphConsumer: SyncContentConsumer<ActionGraphBuildResult> = {
  id: 'action_graph_builder',
  accept(context: ConsumerContext): ConsumerResult<ActionGraphBuildResult> {
    if (!context.model.compiler.capabilities.planner) {
      return {
        consumerId: 'action_graph_builder',
        fromCcmVersion: context.model.version,
        confidence: 0,
        result: {
          schemaVersion: 1,
          immutable: true,
          fromCcmVersion: context.model.version,
          contentHash: context.model.contentHash,
          fromKnowledgeGraphHash: '',
          builtAt: context.model.compiledAt,
          actions: [],
          roots: [],
        },
        trace: { notes: ['capabilities.planner=false'] },
      };
    }
    const result = buildActionGraph(context.model, {
      builtAt: context.model.compiledAt,
    });
    return {
      consumerId: 'action_graph_builder',
      fromCcmVersion: context.model.version,
      confidence: 1,
      result,
      recommendations: result.actions,
    };
  },
};

export const judgeConsumer: ContentConsumer<JudgeVerdict> = {
  id: 'judge',
  accept(context: ConsumerContext): ConsumerResult<JudgeVerdict> {
    const prior = context.priorModel ?? context.model;
    const diff = context.diff ?? diffModels(prior, context.model);
    void diff;
    const result = judgeModels(prior, context.model, {
      beforeActions: context.actionGraph,
    });
    return {
      consumerId: 'judge',
      fromCcmVersion: context.model.version,
      confidence: result.verdict === 'unchanged' ? 1 : 0.8,
      result,
    };
  },
};

export { benchmarkConsumer };
