/**
 * Integration smoke: Observation → Action → Feature delta → Strategy
 * (no live DB / DeepSeek — exercises the growth loop contracts end-to-end in-memory).
 */
import { createMemoryFeatureStore, setFeatureStore, persistFeatureRun } from '../../lib/featureStoreCore';
import {
  observationsFromGscLowCtr,
  observationsFromAuditIssues,
  observationsFromVisibilityDelta,
} from '../../lib/emitObservations';
import { actionsFromObservations } from '../../lib/observations/actionsFromObservations';
import { scopeFromAction, auditIssueIdFromAction } from '../../lib/observations/optimizeActionScope';
import { applyStrategy, prioritizeActions } from '../../lib/primitives/prioritizeActions';
import { persistCoverageFeatureRun } from '../../lib/persistCoverageFeatureRun';
import type { CoverageSnapshot } from '../../lib/aiCoverage';

function stubSnapshot(overall = 40): CoverageSnapshot {
  return {
    schemaVersion: 1,
    judgeVersion: 'v1',
    promptVersion: 'v1',
    model: 'test',
    createdAt: '2026-07-17T10:00:00.000Z',
    items: [
      {
        id: 'q-faq-1',
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
    overall,
  } as CoverageSnapshot;
}

describe('growth pipeline integration smoke', () => {
  afterEach(() => setFeatureStore(null));

  it('GSC + Audit + Vis observations → actions → strategy filters', () => {
    const obs = [
      ...observationsFromGscLowCtr(
        [{ page: '/pricing', impressions: 500, clicks: 2 }],
        { domainId: 1 },
      ),
      ...observationsFromAuditIssues(
        [{ id: 'title_too_long', label: 'Title too long', severity: 'warn', count: 4 }],
        { domainId: 1 },
      ),
      ...observationsFromVisibilityDelta({ visibilityScore: -15 }, { domainId: 1, scanId: 9 }),
    ];
    expect(obs.length).toBeGreaterThanOrEqual(3);

    const actions = prioritizeActions(actionsFromObservations(obs));
    expect(actions.some((a) => a.origin === 'performance')).toBe(true);
    expect(actions.some((a) => a.origin === 'audit')).toBe(true);
    expect(actions.some((a) => a.origin === 'visibility')).toBe(true);

    const audit = actions.find((a) => a.origin === 'audit')!;
    expect(auditIssueIdFromAction(audit)).toBe('title_too_long');

    const vis = actions.find((a) => a.origin === 'visibility')!;
    expect(scopeFromAction(vis)?.mode).toBe('faq_only');

    const gsc = actions.find((a) => a.origin === 'performance')!;
    expect(scopeFromAction(gsc)?.mode).toBe('action');

    const qw = applyStrategy(actions, { id: 'quick_wins', label: 'qw' });
    expect(qw.every((a) => a.cost === 'easy' || a.expectedLift >= 8)).toBe(true);
  });

  it('coverage persist → two versions → history delta', async () => {
    const store = createMemoryFeatureStore();
    setFeatureStore(store);

    await persistCoverageFeatureRun({
      snapshot: stubSnapshot(30),
      articleId: 99,
      domainId: 1,
      keyword: 'x',
      store,
    });
    await persistCoverageFeatureRun({
      snapshot: { ...stubSnapshot(55), createdAt: '2026-07-17T11:00:00.000Z', overall: 55 },
      articleId: 99,
      domainId: 1,
      keyword: 'x',
      store,
    });

    const features = await store.listFeatures({ articleId: 99, featureId: 'coverage' });
    expect(features).toHaveLength(2);
    expect(features[0].version).toBe(2);
    expect(features[1].version).toBe(1);
    expect(features[0].createdAt >= features[1].createdAt).toBe(true);

    const obs = await store.listObservations({ articleId: 99 });
    expect(obs.length).toBeGreaterThan(0);

    await persistFeatureRun(
      {
        observations: observationsFromGscLowCtr(
          [{ page: '/a', impressions: 100, clicks: 0 }],
          { domainId: 1 },
        ),
        features: [],
      },
      { domainId: 1, articleId: 99 },
      store,
    );
    const allObs = await store.listObservations({ articleId: 99 });
    expect(allObs.some((o) => o.kind === 'low_ctr')).toBe(true);
  });

  it('FAQ action scopes to faq_only with relatedQuestions', () => {
    const scope = scopeFromAction({
      id: 'a1',
      type: 'add_faq',
      title: 'Add FAQ',
      instruction: 'Add FAQ for What is X?',
      expectedLift: 8,
      confidence: 0.8,
      cost: 'easy',
      reason: 'gap',
      origin: 'coverage',
      appliesTo: { kind: 'article' },
      relatedQuestions: ['q-faq-1'],
    });
    expect(scope).toEqual({
      mode: 'faq_only',
      questionIds: ['q-faq-1'],
      instruction: 'Add FAQ for What is X?',
    });
  });
});
