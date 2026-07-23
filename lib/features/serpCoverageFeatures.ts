import type { Feature, ScoreVector, Signal, Action } from '../primitives/types';
import { getFeatureStore } from '../featureStore';

/** Persist lightweight serp/coverage features for planner consumption. */
export async function upsertSerpCoverageFeatures(opts: {
  workspaceId: string;
  articleId?: number;
  domainId?: number;
  keyword: string;
  corpusVersion?: number;
  concepts: Array<{ id: string; label: string }>;
  terms: Array<{ id: string; label: string }>;
}): Promise<Feature> {
  const signals: Signal[] = [
    { id: 'concept_count', key: 'concept_count', value: opts.concepts.length },
    { id: 'term_count', key: 'term_count', value: opts.terms.length },
    { id: 'corpus_version', key: 'corpus_version', value: opts.corpusVersion ?? 0 },
  ];

  const score: ScoreVector = {
    score: Math.min(100, opts.concepts.length * 2 + opts.terms.length),
    confidence: 0.7,
    version: 1,
    contributors: [
      { id: 'concepts', label: 'Concepts', delta: opts.concepts.length },
      { id: 'terms', label: 'Terms', delta: opts.terms.length },
    ],
  };

  const actions: Action[] = opts.concepts.slice(0, 5).map((c) => ({
    id: `act-cover-${c.id}`,
    type: 'add_entity',
    title: `Cover concept: ${c.label}`,
    instruction: `Include the concept "${c.label}" naturally in the article.`,
    expectedLift: 3,
    confidence: 0.65,
    cost: 'easy',
    reason: 'Missing concept from SERP corpus',
    origin: 'coverage',
    appliesTo: {
      kind: 'article',
      id: opts.articleId != null ? String(opts.articleId) : undefined,
    },
    generatedBy: 'serpCoverageFeatures',
    featureId: 'coverage',
  }));

  const feature: Feature = {
    id: `coverage:${opts.workspaceId}:${opts.keyword}`,
    version: Date.now(),
    createdAt: new Date().toISOString(),
    score,
    confidence: 0.7,
    signals,
    actions,
    observationIds: [],
  };

  const store = getFeatureStore();
  await store.appendFeature(feature, {
    articleId: opts.articleId,
    domainId: opts.domainId,
  });
  return feature;
}
