import * as approvedOutline from '../../../lib/contentPlanner/applyApprovedOutline';
import { applyApprovedOutlineToPlan } from '../../../lib/contentPlanner/applyApprovedOutline';
import type { ArticleExecutionPlan, ExecutionPlanSection } from '../../../lib/contentPlanner/types';

function section(id: string): ExecutionPlanSection {
  return {
    id,
heading: id,
objective: 'Cover the section',
priority: 'high',
expectedWords: 280,
    claims: [{ id: `${id}-claim`, statement: 'claim', sources: [] }],
entities: ['entity'],
    questions: ['question?'],
mustAnswer: ['answer'],
evidence: [],
blocks: ['summary'],
    budget: { words: 280, claims: 1, entities: 1, questions: 1, examples: 0, lists: 0, tables: 0, images: 0, faq: 0, citations: 0 },
    writerHints: { previousSection: null, nextSection: null, transition: '', tone: 'practical', avoidRepeating: [] },
    reason: { summary: 'original', signals: [] },
  };
}

function plan(sections: ExecutionPlanSection[]): ArticleExecutionPlan {
  return {
    schemaVersion: 2,
plannerVersion: 'test',
planHash: 'placeholder',
keyword: 'keyword',
title: 'Title',
narrative: 'step_by_step',
    quickAnswer: 'A sufficiently long answer for the test.',
    reader: { persona: 'reader', goal: 'learn', tone: 'practical', timeBudgetMinutes: 5 },
    articleBudget: {
      words: 1000,
paragraphs: 10,
h2: 2,
lists: 0,
tables: 0,
images: 0,
      claims: 2,
questions: 2,
examples: 0,
warnings: 0,
checklists: 0,
comparisons: 0,
faq: 0,
    },
    benchmark: {
      averageWords: 1000,
bestWords: 1000,
averageH2: 2,
averageParagraphs: 10,
      averageLists: 0,
averageTables: 0,
averageImages: 0,
averageFaq: 0,
      averageClaims: 2,
averageExamples: 0,
averageQuestions: 2,
targetWords: 1000,
targetH2: 2,
    },
    knowledgeCoverage: {
      criticalClaims: { total: 2, assigned: 2, pct: 100 },
      questions: { total: 2, assigned: 2, pct: 100 },
      evidenceNeeds: { total: 0, assigned: 0, pct: 100 },
      knowledgeCoveragePct: 100,
    },
    requiredCoverage: { claims: 2, questions: 2, entities: 1, evidence: 0, examples: 0 },
sections,
builtAt: '2026-08-05T00:00:00.000Z',
  };
}

describe('applyApprovedOutlineToPlan', () => {
  it('renames one-to-one sections and preserves planner assignments', () => {
    const source = plan([section('one'), section('two')]);
    const next = applyApprovedOutlineToPlan(source, [
      { level: 1, text: 'Custom title' }, { level: 2, text: 'First' }, { level: 2, text: 'Second' },
    ]);
    expect(next.title).toBe('Custom title');
    expect(next.sections.map((item) => item.heading)).toEqual(['First', 'Second']);
    expect(next.sections[0].claims).toEqual(source.sections[0].claims);
  });

  it('does not change section count and drop validated coverage', () => {
    const source = plan([section('one'), section('two')]);
    expect(applyApprovedOutlineToPlan(source, [{ level: 2, text: 'Only one section' }])).toBe(source);
  });
});

describe('approved outline module', () => {
  it('does not expose a builder that bypasses the Plan Validator', () => {
    expect('buildExecutionPlanFromApprovedOutline' in approvedOutline).toBe(false);
  });
});
