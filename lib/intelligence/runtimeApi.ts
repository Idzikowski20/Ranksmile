/**
 * Runtime API (07-runtime.md): compileArticle / getCcm / projections.
 * Store is injected — InMemory for tests, SqlCompileStore for HTTP.
 */
import type { CanonicalContentModel } from '../ccm/types/ccm';
import type { ActionGraph } from '../ccm/types/actionGraph';
import type { ContentProfileId } from '../ccm/types/status';
import { isEntityNode, isFactNode } from '../ccm/types/graph';
import { compile } from '../compiler/compile';
import type { CompileSource } from '../compiler/types';
import {
  getDependencyGraph,
  type CompileDependencyGraph,
} from '../compiler/incremental';
import { projectCoverage, type CoverageView } from '../projections/coverageView';
import {
  projectVisibility,
  type VisibilityProjection,
} from '../projections/visibilityView';
import { buildActionGraph } from '../planner/actionGraphBuilder';
import { createConsumerContext, type ConsumerResult } from './consumerContext';
import { coverageConsumer, visibilityConsumer, actionGraphConsumer } from './consumers';
import {
  buildWiScorecard,
  type WiScorecard,
} from './writingIntelligence';
import { acceptHistoryAsync, type CompileStore } from './compileStore';
import {
  buildInfoToCoverFromCcm,
  type CcmInfoToCover,
} from './ccmToInfoToCover';
import {
  summarizeRecommendations,
  type CcmRecommendation,
} from './ccmRecommendations';

export type ArticleSourceInput =
  | CompileSource
  | { readonly kind: 'html'; readonly html: string };

export type CompileArticleOpts = {
  readonly articleId: string;
  readonly compiledAt: string;
  readonly source: ArticleSourceInput;
  readonly mode?: 'full' | 'incremental';
  readonly dirtyBlockIds?: readonly string[];
  readonly profile?: ContentProfileId;
  readonly ccmId?: string;
  readonly version?: number;
  readonly locale?: string;
  readonly store?: CompileStore;
  /** Persist snapshot + history event when store provided (default true). */
  readonly persist?: boolean;
};

/** Surfer-like product surface over CCM (facts + terms + projections + Info to cover). */
export type ArticleIntelligenceView = {
  readonly coverage: CoverageView;
  readonly visibility: VisibilityProjection;
  readonly writing: WiScorecard;
  readonly facts: readonly {
    readonly id: string;
    readonly statement: string;
    readonly status: string;
  }[];
  /** Entity canonical names — Surfer "terms" analogue. */
  readonly terms: readonly string[];
  /** OQ-8: same accordion shape as legacy Info to cover. */
  readonly infoToCover: CcmInfoToCover;
  /** Top ActionGraph edits for editor (empty when no graph / no gaps). */
  readonly recommendations: readonly CcmRecommendation[];
};

export type CompileArticleResult = {
  readonly model: CanonicalContentModel;
  readonly noop: boolean;
  readonly actionGraph: ActionGraph;
  readonly dependencyGraph: CompileDependencyGraph;
  readonly view: ArticleIntelligenceView;
};

function htmlToPlain(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function readSyncConsumer<T>(value: ConsumerResult<T> | Promise<ConsumerResult<T>>): T {
  if ('then' in value) throw new Error('Synchronous intelligence projection cannot use an async consumer');
  return value.result;
}

export function resolveCompileSource(source: ArticleSourceInput): CompileSource {
  if (source.kind === 'html') {
    return { kind: 'plain', text: htmlToPlain(source.html) };
  }
  return source;
}

/** Build Surfer-parity view from a CCM (+ optional ActionGraph for WI peers). */
export function projectArticleIntelligence(
  model: CanonicalContentModel,
  actionGraph?: ActionGraph,
): ArticleIntelligenceView {
  const ctxBase = createConsumerContext({ model, actionGraph });
  const coverage = readSyncConsumer(coverageConsumer.accept(ctxBase));
  const visibility = readSyncConsumer(visibilityConsumer.accept(ctxBase));
  const writing = buildWiScorecard(
    createConsumerContext({
      model,
      actionGraph,
      peerResults: { coverage, visibility },
    }),
  );
  const facts = model.knowledge.graph.nodes.filter(isFactNode).map((f) => ({
    id: f.id,
    statement: f.statement,
    status: f.status,
  }));
  const terms = model.knowledge.graph.nodes
    .filter(isEntityNode)
    .map((e) => e.canonicalName);
  return {
    coverage,
    visibility,
    writing,
    facts,
    terms,
    infoToCover: buildInfoToCoverFromCcm(model),
    recommendations: summarizeRecommendations(actionGraph),
  };
}

export async function getCcm(
  articleId: string,
  store: CompileStore,
): Promise<CanonicalContentModel | null> {
  return store.get(articleId);
}

/**
 * Compile article source → CCM, optional persist, ActionGraph + Surfer-like view.
 */
export async function compileArticle(
  opts: CompileArticleOpts,
): Promise<CompileArticleResult> {
  const store = opts.store;
  const previous =
    opts.mode === 'incremental' && store
      ? (await store.get(opts.articleId)) ?? undefined
      : undefined;

  const compiled = compile({
    articleId: opts.articleId,
    compiledAt: opts.compiledAt,
    source: resolveCompileSource(opts.source),
    mode: opts.mode ?? 'full',
    dirtyBlockIds: opts.dirtyBlockIds,
    profile: opts.profile,
    ccmId: opts.ccmId,
    version: opts.version ?? (previous ? previous.version + 1 : 1),
    locale: opts.locale,
    previous,
  });

  const agResult = actionGraphConsumer.accept(
    createConsumerContext({ model: compiled.model }),
  );
  const actionGraph = readSyncConsumer(agResult);

  if (store && opts.persist !== false) {
    await acceptHistoryAsync(store, createConsumerContext({
      model: compiled.model,
      actionGraph,
    }));
  }

  const view = projectArticleIntelligence(compiled.model, actionGraph);
  return {
    model: compiled.model,
    noop: compiled.noop,
    actionGraph,
    dependencyGraph: getDependencyGraph(compiled.model),
    view,
  };
}

/** Re-export projection helpers named in 07-runtime.md. */
export { projectCoverage, projectVisibility, buildActionGraph, getDependencyGraph };
