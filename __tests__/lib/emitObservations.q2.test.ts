import {
  observationsFromGscLowCtr,
  observationsFromAuditIssues,
  observationsFromVisibilityDelta,
} from '../../lib/emitObservations';
import { runActionExecution } from '../../lib/runActionExecution';
import type { Action } from '../../lib/primitives/types';

describe('observationsFromGscLowCtr', () => {
  it('emits low_ctr for high-impression low-CTR pages', () => {
    const obs = observationsFromGscLowCtr(
      [
        { page: '/a', impressions: 200, clicks: 1 },
        { page: '/b', impressions: 10, clicks: 0 },
        { page: '/c', impressions: 100, clicks: 20 },
      ],
      { domainId: 1, maxCtr: 0.02 },
    );
    expect(obs).toHaveLength(1);
    expect(obs[0].kind).toBe('low_ctr');
    expect(obs[0].source).toBe('gsc');
  });
});

describe('observationsFromAuditIssues', () => {
  it('maps issues to audit_issue observations', () => {
    const obs = observationsFromAuditIssues(
      [{ id: 'missing_h1', label: 'Missing H1', severity: 'error', count: 3 }],
      { domainId: 2 },
    );
    expect(obs[0].kind).toBe('audit_issue');
    expect(obs[0].severity).toBe('high');
  });
});

describe('observationsFromVisibilityDelta', () => {
  it('only emits on negative visibility delta', () => {
    expect(observationsFromVisibilityDelta({ visibilityScore: 5 }, { domainId: 1 })).toHaveLength(0);
    const drop = observationsFromVisibilityDelta({ visibilityScore: -12 }, { domainId: 1, scanId: 9 });
    expect(drop).toHaveLength(1);
    expect(drop[0].kind).toBe('visibility_drop');
  });
});

describe('runActionExecution', () => {
  it('LLM returns running with ao resultRef', async () => {
    const action: Action = {
      id: 'a1',
      type: 'rewrite_section',
      title: 'Rewrite',
      instruction: 'x',
      expectedLift: 5,
      confidence: 0.8,
      cost: 'medium',
      reason: 'x',
      origin: 'coverage',
      appliesTo: { kind: 'section', id: 's1' },
    };
    const ex = await runActionExecution({ action, articleId: 3 });
    expect(ex.executor).toBe('llm');
    expect(ex.status).toBe('running');
    expect(ex.resultRef).toContain('ao:rewrite:3');
  });

  it('WP requires confirm', async () => {
    const action: Action = {
      id: 'p1',
      type: 'publish',
      title: 'Publish',
      instruction: 'Publish',
      expectedLift: 0,
      confidence: 1,
      cost: 'easy',
      reason: 'publish',
      origin: 'planner',
      appliesTo: { kind: 'article' },
    };
    const pending = await runActionExecution({ action, articleId: 3 });
    expect(pending.status).toBe('pending');
    const done = await runActionExecution({ action, articleId: 3, confirmed: true });
    expect(done.status).toBe('done');
  });
});
