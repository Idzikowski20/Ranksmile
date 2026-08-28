import { projectCoverage, type CoverageView } from '@/src/core/projections/coverageView';
import {
  projectVisibility,
  type VisibilityProjection,
} from '@/src/core/projections/visibilityView';
import { buildActionGraph } from '@/src/core/planner/actionGraphBuilder';
import type { ActionGraph } from '@/src/core/ccm/types/actionGraph';
import { judgeModels, type JudgeVerdict } from '@/src/core/intelligence/judge';
import { diffModels } from '@/src/core/intelligence/modelDiff';
import {
  type ConsumerContext,
  type ConsumerResult,
  type ContentConsumer,
  type SyncContentConsumer,
} from '@/src/core/intelligence/consumerContext';
import { benchmarkConsumer } from '@/src/core/intelligence/benchmark';

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
