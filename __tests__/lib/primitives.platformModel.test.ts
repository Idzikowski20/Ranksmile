import { defaultFeatureRegistry, FeatureRegistry } from '../../lib/primitives/featureRegistry';
import { listCapabilities, getCapability } from '../../lib/primitives/capabilities';
import { emptyKnowledgeLayer } from '../../lib/primitives/knowledgeLayer';
import { pendingExecution } from '../../lib/primitives/actionExecutor';
import type { Feature } from '../../lib/primitives/types';
import {
  observationsFromCoverage,
  runFeatures,
} from '../../lib/features/featureEngine';
import type { CoverageSnapshot } from '../../lib/aiCoverage';

function stubSnapshot(overrides?: Partial<CoverageSnapshot>): CoverageSnapshot {
  return {
    keyword: 'test',
    createdAt: '2026-07-17T00:00:00.000Z',
    items: [
      {
        id: 'q1',
        label: 'What is X?',
        type: 'question',
        covered: false,
        importance: 'critical',
        quality: 0,
        reason: 'missing',
      },
    ],
    ...overrides,
  } as CoverageSnapshot;
}

describe('FeatureRegistry', () => {
  it('orders producers by dependencies', () => {
    const reg = new FeatureRegistry();
    reg.register({
      id: 'b',
      version: 1,
      dependencies: ['a'],
      producer: { id: 'b', produce: () => null },
    });
    reg.register({
      id: 'a',
      version: 2,
      dependencies: [],
      producer: { id: 'a', produce: () => null },
    });
    expect(reg.list().map((r) => r.id)).toEqual(['a', 'b']);
    expect(reg.version('a')).toBe(2);
    expect(reg.dependencies('b')).toEqual(['a']);
  });

  it('has coverage registered by default', () => {
    expect(defaultFeatureRegistry.has('coverage')).toBe(true);
  });
});

describe('observationsFromCoverage', () => {
  it('emits Observation facts for uncovered items', () => {
    const obs = observationsFromCoverage(stubSnapshot());
    expect(obs).toHaveLength(1);
    expect(obs[0].kind).toBe('missing_topic');
    expect(obs[0].source).toBe('coverage');
    expect(obs[0].id).toBe('obs-coverage-q1');
  });
});

describe('runFeatures', () => {
  it('returns immutable Feature with version + createdAt + actions', () => {
    const { features, actions, observations } = runFeatures({ snapshot: stubSnapshot() });
    expect(observations.length).toBeGreaterThan(0);
    expect(features.length).toBeGreaterThanOrEqual(1);
    const f = features[0] as Feature;
    expect(f.id).toBe('coverage');
    expect(f.version).toBe(1);
    expect(typeof f.createdAt).toBe('string');
    expect(f.score.distribution || f.score.contributors).toBeTruthy();
    expect(Array.isArray(actions)).toBe(true);
  });
});

describe('Capability Layer', () => {
  it('lists capabilities agents can discover', () => {
    const all = listCapabilities();
    expect(all.length).toBeGreaterThan(5);
    expect(getCapability('generate_faq')?.available).toBe(true);
    expect(getCapability('generate_brief')?.available).toBe(true);
  });
});

describe('Knowledge Layer + ActionExecution stubs', () => {
  it('starts empty and pending executions are typed', () => {
    const kg = emptyKnowledgeLayer();
    expect(kg.topics).toEqual([]);
    expect(kg.edges).toEqual([]);
    const ex = pendingExecution('a1', 'llm');
    expect(ex.status).toBe('pending');
    expect(ex.executor).toBe('llm');
  });
});
