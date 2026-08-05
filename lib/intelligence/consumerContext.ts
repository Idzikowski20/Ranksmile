import type { ActionGraph } from '../ccm/types/actionGraph';
import type { CanonicalContentModel } from '../ccm/types/ccm';
import { graphQuery, type GraphQuery } from '../ccm/graphQuery';
import type { ModelDiff } from './modelDiff';

export type ConsumerId =
  | 'coverage_projection'
  | 'visibility_projection'
  | 'action_graph_builder'
  | 'planner'
  | 'judge'
  | 'benchmark'
  | 'writing_intelligence'
  | 'editorial_intelligence'
  | 'optimization_intelligence'
  | 'history';

export type CompileEvent =
  | {
      readonly type: 'CompileStarted';
      readonly at: string;
      readonly articleId: string;
      readonly mode: string;
    }
  | {
      readonly type: 'CompileFinished';
      readonly at: string;
      readonly ccmVersion: number;
      readonly deterministicHash: string;
      readonly partial: boolean;
    }
  | {
      readonly type: 'ActionGraphBuilt';
      readonly at: string;
      readonly ccmVersion: number;
    }
  | {
      readonly type: 'PlannerRun';
      readonly at: string;
      readonly ccmVersion: number;
      readonly strategy: string;
      readonly selectedActionIds: readonly string[];
    }
  | {
      readonly type: 'JudgeRun';
      readonly at: string;
      readonly fromVersion: number;
      readonly toVersion: number;
      readonly verdict: string;
    }
  | {
      readonly type: 'ConsumerRun';
      readonly at: string;
      readonly consumerId: string;
      readonly ccmVersion: number;
    };

export type ActionBudget = {
  readonly maxActions: number;
  readonly maxLlmCalls: number;
  readonly maxTokens?: number;
  readonly maxDurationMs?: number;
};

export type PeerResults = {
  readonly coverage?: unknown;
  readonly judge?: unknown;
  readonly planner?: unknown;
  readonly visibility?: unknown;
  readonly benchmark?: unknown;
};

export type RuntimeHandle = {
  graphQuery(model: CanonicalContentModel): GraphQuery;
};

export type ConsumerContext = {
  readonly model: CanonicalContentModel;
  readonly priorModel?: CanonicalContentModel;
  readonly diff?: ModelDiff;
  readonly actionGraph?: ActionGraph;
  readonly history?: readonly CompileEvent[];
  readonly budget?: ActionBudget;
  readonly peerResults?: PeerResults;
  readonly runtime: RuntimeHandle;
};

export type ConsumerResult<T> = {
  readonly consumerId: ConsumerId;
  readonly fromCcmVersion: number;
  readonly confidence: number;
  readonly result: T;
  readonly recommendations?: ActionGraph['actions'];
  readonly trace?: { readonly notes: readonly string[] };
};

export type ContentConsumer<TResult> = {
  readonly id: ConsumerId;
  accept(
    context: ConsumerContext,
  ): Promise<ConsumerResult<TResult>> | ConsumerResult<TResult>;
};

const defaultRuntime: RuntimeHandle = {
  graphQuery,
};

export type CreateContextOpts = {
  readonly model: CanonicalContentModel;
  readonly priorModel?: CanonicalContentModel;
  readonly diff?: ModelDiff;
  readonly actionGraph?: ActionGraph;
  readonly history?: readonly CompileEvent[];
  readonly budget?: ActionBudget;
  readonly peerResults?: PeerResults;
  readonly runtime?: RuntimeHandle;
};

export function createConsumerContext(opts: CreateContextOpts): ConsumerContext {
  return {
    model: opts.model,
    priorModel: opts.priorModel,
    diff: opts.diff,
    actionGraph: opts.actionGraph,
    history: opts.history,
    budget: opts.budget,
    peerResults: opts.peerResults,
    runtime: opts.runtime ?? defaultRuntime,
  };
}
