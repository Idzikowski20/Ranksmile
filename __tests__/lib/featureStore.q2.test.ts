import {
  createMemoryFeatureStore,
  computeFeatureScoreDelta,
  persistFeatureRun,
  setFeatureStore,
} from '../../lib/featureStoreCore';
import type { Feature, Observation } from '../../lib/primitives/types';
import { buildKnowledgeLayer } from '../../lib/primitives/knowledgeLayer';
import { executeAction, pickExecutor } from '../../lib/primitives/actionExecutor';
import { assignExperimentBucket, COVERAGE_EXPERIMENT, withExperiment } from '../../lib/primitives/experiments';

const obs = (partial: Partial<Observation> & Pick<Observation, 'id' | 'title'>): Observation => ({
  kind: 'missing_topic',
  source: 'coverage',
  observedAt: partial.observedAt || '2026-03-01T00:00:00.000Z',
  ...partial,
  id: partial.id,
  title: partial.title,
});

const feat = (partial: Partial<Feature> & Pick<Feature, 'id' | 'version' | 'createdAt' | 'score'>): Feature => ({
  confidence: 0.8,
  signals: [],
  actions: [],
  ...partial,
  id: partial.id,
  version: partial.version,
  createdAt: partial.createdAt,
  score: partial.score,
});

describe('memory FeatureStore', () => {
  it('appends observations and features; never overwrites', async () => {
    const store = createMemoryFeatureStore();
    await store.appendObservation(obs({ id: 'o1', title: 'Missing FAQ', articleId: 1 }));
    await store.appendFeature(
      feat({
        id: 'coverage',
        version: 1,
        createdAt: '2026-03-01T00:00:00.000Z',
        score: { score: 40, value: 40, confidence: 0.7, version: 1, contributors: [] },
      }),
      { articleId: 1 },
    );
    await store.appendFeature(
      feat({
        id: 'coverage',
        version: 2,
        createdAt: '2026-06-01T00:00:00.000Z',
        score: { score: 55, value: 55, confidence: 0.7, version: 1, contributors: [] },
      }),
      { articleId: 1 },
    );
    const features = await store.listFeatures({ featureId: 'coverage', articleId: 1 });
    expect(features).toHaveLength(2);
    expect(features[0].version).toBe(2);
    const delta = await store.featureScoreDelta('coverage', '2026-04-01T00:00:00.000Z', { articleId: 1 });
    expect(delta.before?.score.score).toBe(40);
    expect(delta.after?.score.score).toBe(55);
    expect(delta.scoreDelta).toBe(15);
  });

  it('persistFeatureRun uses injected store', async () => {
    const store = createMemoryFeatureStore();
    setFeatureStore(store);
    await persistFeatureRun({
      observations: [obs({ id: 'o2', title: 'Low CTR', kind: 'low_ctr', source: 'gsc' })],
      features: [
        feat({
          id: 'coverage',
          version: 1,
          createdAt: '2026-07-01T00:00:00.000Z',
          score: { score: 10, confidence: 0.5, version: 1, contributors: [] },
        }),
      ],
    });
    expect(await store.listObservations()).toHaveLength(1);
    expect(await store.listFeatures()).toHaveLength(1);
    setFeatureStore(null);
  });
});

describe('computeFeatureScoreDelta', () => {
  it('computes delta from DESC history', () => {
    const d = computeFeatureScoreDelta(
      [
        feat({
          id: 'coverage',
          version: 2,
          createdAt: '2026-06-01T00:00:00.000Z',
          score: { score: 30, confidence: 1, version: 1, contributors: [] },
        }),
        feat({
          id: 'coverage',
          version: 1,
          createdAt: '2026-02-01T00:00:00.000Z',
          score: { score: 50, confidence: 1, version: 1, contributors: [] },
        }),
      ],
      'coverage',
      '2026-03-01T00:00:00.000Z',
    );
    expect(d.scoreDelta).toBe(-20);
  });
});

describe('Knowledge Layer', () => {
  it('builds Topic→Intent→Question→Page→Action→Outcome chain', () => {
    const kg = buildKnowledgeLayer({
      keyword: 'react hooks',
      articleId: 9,
      articleTitle: 'Hooks guide',
      observations: [
        obs({
          id: 'o1',
          title: 'What is useEffect?',
          relatedQuestionIds: ['q-useeffect'],
          kind: 'missing_faq',
        }),
      ],
      actions: [
        {
          id: 'a1',
          type: 'add_faq',
          title: 'Add FAQ',
          instruction: 'Add FAQ',
          expectedLift: 8,
          confidence: 0.8,
          cost: 'easy',
          reason: 'gap',
          origin: 'coverage',
          appliesTo: { kind: 'article' },
          relatedQuestions: ['q-useeffect'],
        },
      ],
    });
    expect(kg.topics[0].label).toBe('react hooks');
    expect(kg.questions.some((q) => q.id === 'q-useeffect')).toBe(true);
    expect(kg.actions).toHaveLength(1);
    expect(kg.outcomes).toHaveLength(1);
    expect(kg.edges.some((e) => e.rel === 'recommends')).toBe(true);
  });
});

describe('Action Executors', () => {
  it('picks llm for rewrite and manual as fallback', async () => {
    const rewrite = {
      id: 'r1',
      type: 'rewrite_section' as const,
      title: 'Rewrite',
      instruction: 'x',
      expectedLift: 5,
      confidence: 0.7,
      cost: 'medium' as const,
      reason: 'x',
      origin: 'coverage' as const,
      appliesTo: { kind: 'section' as const },
    };
    expect(pickExecutor(rewrite).id).toBe('llm');
    const ex = await executeAction(rewrite);
    expect(ex.status).toBe('pending');
    expect(ex.executor).toBe('llm');

    const custom = { ...rewrite, id: 'c1', type: 'custom' as const };
    expect(pickExecutor(custom).id).toBe('manual');
    const done = await executeAction(custom);
    expect(done.status).toBe('done');
  });
});

describe('Experiments', () => {
  it('assigns stable variant for same subject', () => {
    const a = assignExperimentBucket(COVERAGE_EXPERIMENT, 'article:42');
    const b = assignExperimentBucket(COVERAGE_EXPERIMENT, 'article:42');
    expect(a).toEqual(b);
    expect(['coverage-v2', 'coverage-v3']).toContain(a.variant);
    const versions = withExperiment(
      { schemaVersion: 1, pipelineVersion: 4, scoringVersion: 3 },
      a,
    );
    expect(versions.experimentId).toBe('coverage-scoring');
    expect(versions.experimentVariant).toBe(a.variant);
  });
});
