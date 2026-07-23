import { actionsFromObservations, isLlmAction } from '../../lib/observations/actionsFromObservations';
import { applyStrategy, prioritizeActions } from '../../lib/primitives/prioritizeActions';
import { computeFeatureScoreDelta } from '../../lib/featureStoreCore';
import type { Action, Feature, Observation } from '../../lib/primitives/types';

const obs = (partial: Partial<Observation> & Pick<Observation, 'id' | 'kind' | 'source' | 'title'>): Observation => ({
  observedAt: '2026-07-17T00:00:00.000Z',
  confidence: 0.7,
  ...partial,
});

describe('actionsFromObservations', () => {
  it('maps GSC / audit / visibility observations to Actions', () => {
    const actions = actionsFromObservations([
      obs({ id: 'o1', kind: 'low_ctr', source: 'gsc', title: 'Low CTR: /blog', severity: 'high', detail: '1%' }),
      obs({ id: 'o2', kind: 'audit_issue', source: 'audit', title: 'error: missing h1', severity: 'high' }),
      obs({ id: 'o3', kind: 'visibility_drop', source: 'ai_visibility', title: 'Visibility -12%', score: -12 }),
    ]);
    expect(actions).toHaveLength(3);
    expect(actions[0].origin).toBe('performance');
    expect(actions[1].origin).toBe('audit');
    expect(actions[2].origin).toBe('visibility');
    expect(isLlmAction(actions[0]!)).toBe(true);
    expect(isLlmAction(actions[2]!)).toBe(true);
  });
});

describe('strategy filter on mixed actions', () => {
  it('quick_wins keeps easy or high lift', () => {
    const mixed: Action[] = [
      {
        id: '1',
        type: 'custom',
        title: 'Hard audit',
        instruction: 'x',
        expectedLift: 3,
        confidence: 0.7,
        cost: 'large',
        reason: 'x',
        origin: 'audit',
        appliesTo: { kind: 'domain' },
      },
      {
        id: '2',
        type: 'add_faq',
        title: 'FAQ',
        instruction: 'x',
        expectedLift: 4,
        confidence: 0.8,
        cost: 'easy',
        reason: 'x',
        origin: 'coverage',
        appliesTo: { kind: 'article' },
      },
      {
        id: '3',
        type: 'cover_question',
        title: 'Vis',
        instruction: 'x',
        expectedLift: 12,
        confidence: 0.7,
        cost: 'medium',
        reason: 'x',
        origin: 'visibility',
        featureId: 'visibility',
        appliesTo: { kind: 'domain' },
      },
    ];
    const ranked = prioritizeActions(mixed);
    const qw = applyStrategy(ranked, { id: 'quick_wins', label: 'Quick wins' });
    expect(qw.map((a) => a.id).sort()).toEqual(['2', '3']);
    const vis = applyStrategy(ranked, { id: 'ai_visibility_focus', label: 'AI' });
    expect(vis.map((a) => a.id)).toEqual(['3']);
  });
});

describe('smoke: Observation → Feature delta path', () => {
  it('computes score delta across two feature versions', () => {
    const feat = (version: number, score: number, at: string): Feature => ({
      id: 'coverage',
      version,
      createdAt: at,
      score: { score, value: score, confidence: 0.8, version: 1, contributors: [] },
      confidence: 0.8,
      signals: [],
      actions: [],
    });
    const delta = computeFeatureScoreDelta(
      [
        feat(2, 60, '2026-07-01T00:00:00.000Z'),
        feat(1, 40, '2026-06-01T00:00:00.000Z'),
      ],
      'coverage',
      '2026-06-15T00:00:00.000Z',
    );
    expect(delta.scoreDelta).toBe(20);
    expect(delta.before?.version).toBe(1);
    expect(delta.after?.version).toBe(2);
  });
});
