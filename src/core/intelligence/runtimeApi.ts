/**
 * Runtime API (07-runtime.md): compileArticle / getCcm / projections.
 * Store is injected — InMemory for tests, SqlCompileStore for HTTP.
 */
import type { CanonicalContentModel } from '@/src/core/ccm/types/ccm';
import type { ActionGraph } from '@/src/core/ccm/types/actionGraph';
import type { ContentProfileId } from '@/src/core/ccm/types/status';
import { isEntityNode, isFactNode } from '@/src/core/ccm/types/graph';
import { compile } from '@/src/core/compiler/compile';
import type { CompileSource } from '@/src/core/compiler/types';
import {
  getDependencyGraph,
  type CompileDependencyGraph,
} from '@/src/core/compiler/incremental';
import { projectCoverage, type CoverageView } from '@/src/core/projections/coverageView';
import {
  projectVisibility,
  type VisibilityProjection,
} from '@/src/core/projections/visibilityView';
import { buildActionGraph } from '@/src/core/planner/actionGraphBuilder';
import { createConsumerContext } from '@/src/core/intelligence/consumerContext';
import { coverageConsumer, visibilityConsumer, actionGraphConsumer } from '@/src/core/intelligence/consumers';
import {
  buildWiScorecard,
  type WiScorecard,
} from '@/src/core/intelligence/writingIntelligence';
import { acceptHistoryAsync, type CompileStore } from '@/src/core/intelligence/compileStore';
import {
  buildInfoToCoverFromCcm,
  type CcmInfoToCover,
} from '@/src/core/intelligence/ccmToInfoToCover';
import {
  summarizeRecommendations,
  type CcmRecommendation,
} from '@/src/core/intelligence/ccmRecommendations';

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
  const coverage = coverageConsumer.accept(ctxBase).result;
  const visibility = visibilityConsumer.accept(ctxBase).result;
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
  const actionGraph = agResult.result;

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
