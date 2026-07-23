import { createMemoryFeatureStore, setFeatureStore } from '../../lib/featureStoreCore';
import { persistCoverageFeatureRun } from '../../lib/persistCoverageFeatureRun';
import type { CoverageSnapshot } from '../../lib/aiCoverage';

function stubSnapshot(): CoverageSnapshot {
  return {
    schemaVersion: 1,
    judgeVersion: 'v1',
    promptVersion: 'v1',
    model: 'test',
    createdAt: '2026-07-17T12:00:00.000Z',
    items: [
      {
        id: 'q1',
        label: 'What is X?',
        type: 'paa',
        category: 'knowledge',
        importance: 'critical',
        source: 'paa',
        covered: false,
        quality: 0,
      },
    ],
    buckets: [
      { key: 'knowledge', label: 'Knowledge', weight: 2, items: 1, covered: 0, earned: 0, max: 2, score: 0 },
    ],
    answersMainQuestionEarly: false,
    overall: 12,
  } as CoverageSnapshot;
}

describe('persistCoverageFeatureRun', () => {
  afterEach(() => setFeatureStore(null));

  it('appends observation + coverage feature version with experiment', async () => {
    const store = createMemoryFeatureStore();
    setFeatureStore(store);

    const r1 = await persistCoverageFeatureRun({
      snapshot: stubSnapshot(),
      articleId: 42,
      domainId: 7,
      keyword: 'react hooks',
      store,
    });
    expect(r1.experiment.id).toBe('coverage-scoring');
    expect(r1.features[0]?.version).toBe(1);
    expect(r1.observations.length).toBeGreaterThan(0);

    const r2 = await persistCoverageFeatureRun({
      snapshot: stubSnapshot(),
      articleId: 42,
      store,
    });
    expect(r2.features[0]?.version).toBe(2);

    const features = await store.listFeatures({ articleId: 42, featureId: 'coverage' });
    expect(features).toHaveLength(2);
    const obs = await store.listObservations({ articleId: 42 });
    expect(obs.length).toBeGreaterThanOrEqual(2);
  });
});
