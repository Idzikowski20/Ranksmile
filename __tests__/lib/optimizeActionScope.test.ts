import { scopeFromAction, auditIssueIdFromAction } from '../../lib/observations/optimizeActionScope';
import type { Action } from '../../lib/primitives/types';

const base = (over: Partial<Action> & Pick<Action, 'id' | 'type' | 'title'>): Action => ({
  instruction: over.instruction || over.title,
  expectedLift: 5,
  confidence: 0.8,
  cost: 'medium',
  reason: over.title,
  origin: 'coverage',
  appliesTo: { kind: 'article' },
  ...over,
});

describe('optimizeActionScope', () => {
  it('maps FAQ/cover to faq_only', () => {
    expect(scopeFromAction(base({ id: '1', type: 'add_faq', title: 'FAQ', relatedQuestions: ['q1'] }))).toMatchObject({
      mode: 'faq_only',
      questionIds: ['q1'],
    });
  });

  it('maps rewrite to surgical action', () => {
    expect(scopeFromAction(base({ id: '2', type: 'rewrite_section', title: 'Rewrite', instruction: 'Fix intro' }))).toEqual({
      mode: 'action',
      instruction: 'Fix intro',
    });
  });

  it('extracts audit issue id', () => {
    expect(
      auditIssueIdFromAction(
        base({
          id: '3',
          type: 'custom',
          title: 'Fix',
          origin: 'audit',
          featureId: 'audit',
          relatedEntities: ['title_too_long'],
        }),
      ),
    ).toBe('title_too_long');
  });
});
