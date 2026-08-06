import * as approvedOutline from '../../../lib/contentPlanner/applyApprovedOutline';
import {
  applyApprovedOutlineToPlan,
  approvedOutlineWarnings,
  parseApprovedOutline,
} from '../../../lib/contentPlanner/applyApprovedOutline';
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
    expect(next).not.toBeNull();
    if (!next) throw new Error('Expected matching outline to produce a plan');
    expect(next.title).toBe('Custom title');
    expect(next.sections.map((item) => item.heading)).toEqual(['First', 'Second']);
    expect(next.sections[0].claims).toEqual(source.sections[0].claims);
  });

  it('applies reviewed section instructions and word targets to the write plan', () => {
    const source = plan([section('one'), section('two')]);
    const next = applyApprovedOutlineToPlan(source, [
      { level: 1, text: 'Custom title' },
      { level: 2, text: 'First', instructions: ['Answer the urgent question.', 'Include three steps.'], targetWords: 500 },
      { level: 2, text: 'Second', instructions: ['Give a practical example.'], targetWords: 500 },
    ]);
    expect(next).not.toBeNull();
    if (!next) throw new Error('Expected matching outline to produce a plan');
    expect(next.sections[0].objective).toBe('Answer the urgent question.\nInclude three steps.');
    expect(next.sections[0].expectedWords).toBe(500);
    expect(next.sections[0].budget.words).toBe(500);
    expect(next.articleBudget.words).toBe(1000);
  });

  it('applies reviewed word targets below the benchmark and reports them as warnings', () => {
    const source = plan([section('one'), section('two')]);
    const next = applyApprovedOutlineToPlan(source, [
      { level: 2, text: 'First', targetWords: 80 },
      { level: 2, text: 'Second', targetWords: 80 },
    ]);
    if (!next) throw new Error('Expected a short outline to still produce a plan');
    expect(next.articleBudget.words).toBe(160);
    expect(approvedOutlineWarnings(next).join(' ')).toContain('below the competitor benchmark');
  });

  it('keeps added sections and stubs their brief', () => {
    const source = plan([section('one'), section('two')]);
    const next = applyApprovedOutlineToPlan(source, [
      { level: 2, text: 'First' }, { level: 2, text: 'Second' }, { level: 2, text: 'Third' },
    ]);
    if (!next) throw new Error('Expected an extended outline to produce a plan');
    expect(next.sections.map((item) => item.heading)).toEqual(['First', 'Second', 'Third']);
    expect(next.sections[2].claims).toEqual([]);
    expect(next.articleBudget.h2).toBe(3);
  });

  it('absorbs knowledge from removed sections into the last kept one', () => {
    const source = plan([section('one'), section('two')]);
    const next = applyApprovedOutlineToPlan(source, [{ level: 2, text: 'Only one section' }]);
    if (!next) throw new Error('Expected a shortened outline to produce a plan');
    expect(next.sections).toHaveLength(1);
    expect(next.sections[0].claims.map((c) => c.id)).toEqual(['one-claim', 'two-claim']);
    expect(next.sections[0].mustAnswer).toEqual(['answer']);
  });

  it('folds H3 into the parent H2 instructions instead of adding sections', () => {
    const source = plan([section('one'), section('two')]);
    const next = applyApprovedOutlineToPlan(source, [
      { level: 2, text: 'First', instructions: ['Open with the answer.'] },
      { level: 3, text: 'Nested detail', instructions: ['Use a table.'] },
      { level: 2, text: 'Second' },
    ]);
    if (!next) throw new Error('Expected a nested outline to produce a plan');
    expect(next.sections.map((item) => item.heading)).toEqual(['First', 'Second']);
    expect(next.sections[0].objective).toBe('Open with the answer.\nH3: Nested detail\n- Use a table.');
  });

  it('returns null when the approved outline has no usable heading', () => {
    const source = plan([section('one')]);
    expect(applyApprovedOutlineToPlan(source, [{ level: 1, text: 'Title only' }])).toBeNull();
  });
});

describe('parseApprovedOutline', () => {
  it.each([null, '', false, 0, -20, 12.5])('ignores invalid targetWords %p', (targetWords) => {
    expect(parseApprovedOutline([{ level: 2, text: 'Section', targetWords }])).toEqual([
      { level: 2, text: 'Section' },
    ]);
  });

  it('accepts positive integer word targets', () => {
    expect(parseApprovedOutline([{ level: 2, text: 'Section', targetWords: 320 }])).toEqual([
      { level: 2, text: 'Section', targetWords: 320 },
    ]);
  });
});

describe('approved outline module', () => {
  it('does not expose a builder that bypasses the Plan Validator', () => {
    expect('buildExecutionPlanFromApprovedOutline' in approvedOutline).toBe(false);
  });
});
