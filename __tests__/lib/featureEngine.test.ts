import { runFeatures, coverageFeatureProducer } from '../../lib/features/featureEngine';
import type { CoverageSnapshot } from '../../lib/aiCoverage';

const snap = (overrides?: Partial<CoverageSnapshot>): CoverageSnapshot =>
  ({
    schemaVersion: 1,
    judgeVersion: 'test',
    promptVersion: 'v1',
    model: 'test',
    createdAt: new Date().toISOString(),
    items: [
      {
        id: 'intent-answer-main',
        label: 'Answer the main question',
        type: 'intent',
        category: 'intent',
        importance: 'critical',
        source: 'llm',
        covered: false,
        quality: 1,
      },
    ],
    buckets: [],
    answersMainQuestionEarly: false,
    overall: 40,
    ...overrides,
  }) as CoverageSnapshot;

describe('featureEngine', () => {
  it('coverage producer emits Feature with Action[]', () => {
    const { features, actions } = runFeatures({ snapshot: snap() }, [coverageFeatureProducer]);
    expect(features).toHaveLength(1);
    expect(features[0]!.id).toBe('coverage');
    expect(actions.length).toBeGreaterThan(0);
    expect(actions[0]!.expectedLift).toEqual(expect.any(Number));
    expect(actions[0]!.origin).toBe('coverage');
  });
});
