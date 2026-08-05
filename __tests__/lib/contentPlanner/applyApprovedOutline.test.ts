import {
  applyApprovedOutlineToPlan,
  buildExecutionPlanFromApprovedOutline,
} from '../../../lib/contentPlanner/applyApprovedOutline';
import type { ArticleExecutionPlan, ExecutionPlanSection } from '../../../lib/contentPlanner/types';

function sampleSection(partial?: Partial<ExecutionPlanSection>): ExecutionPlanSection {
  return {
    id: 'sec-0',
    heading: 'Old heading A',
    objective: 'obj',
    priority: 'high',
    expectedWords: 280,
    claims: [{ id: 'c1', statement: 'claim', sources: [] }],
    entities: ['E1'],
    questions: ['Q1?'],
    mustAnswer: ['Must?'],
    evidence: [],
    blocks: ['steps'],
    budget: {
      words: 280,
      claims: 1,
      entities: 1,
      questions: 1,
      examples: 0,
      lists: 0,
      tables: 0,
      images: 0,
      faq: 0,
      citations: 0,
    },
    writerHints: {
      previousSection: null,
      nextSection: null,
      transition: '',
      tone: 'practical',
      avoidRepeating: [],
    },
    reason: { summary: 'orig', signals: ['c1'] },
    ...partial,
  };
}

function samplePlan(sections: ExecutionPlanSection[]): ArticleExecutionPlan {
  return {
    schemaVersion: 2,
    plannerVersion: 'test',
    planHash: 'placeholder',
    keyword: 'kw',
    title: 'Old title',
    narrative: 'step_by_step',
    quickAnswer: 'qa',
    reader: { persona: 'p', goal: 'g', tone: 't', timeBudgetMinutes: 5 },
    articleBudget: {
      words: 1000,
      paragraphs: 20,
      h2: 4,
      lists: 2,
      tables: 0,
      images: 0,
      claims: 4,
      questions: 4,
      examples: 2,
      warnings: 0,
      checklists: 0,
      comparisons: 0,
      faq: 0,
    },
    benchmark: {
      averageWords: 1000,
      bestWords: 1100,
      averageH2: 4,
      averageParagraphs: 20,
      averageLists: 2,
      averageTables: 0,
      averageImages: 0,
      averageFaq: 0,
      averageClaims: 4,
      averageExamples: 2,
      averageQuestions: 4,
      targetWords: 1000,
      targetH2: 4,
    },
    knowledgeCoverage: {
      criticalClaims: { total: 1, assigned: 1, pct: 100 },
      questions: { total: 1, assigned: 1, pct: 100 },
      evidenceNeeds: { total: 0, assigned: 0, pct: 100 },
      knowledgeCoveragePct: 100,
    },
    requiredCoverage: { claims: 1, questions: 1, entities: 1, evidence: 0, examples: 0 },
    sections,
    builtAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('applyApprovedOutlineToPlan', () => {
  it('renames sections by index and keeps planner claims', () => {
    const plan = samplePlan([
      sampleSection({ id: 'sec-0', heading: 'A' }),
      sampleSection({ id: 'sec-1', heading: 'B', claims: [] }),
    ]);
    const next = applyApprovedOutlineToPlan(plan, [
      { level: 2, text: 'New A' },
      { level: 2, text: 'New B' },
    ]);
    expect(next.sections).toHaveLength(2);
    expect(next.sections[0].heading).toBe('New A');
    expect(next.sections[0].claims[0]?.id).toBe('c1');
    expect(next.sections[1].heading).toBe('New B');
    expect(next.planHash).not.toBe('placeholder');
    expect(next.planHash).toHaveLength(32);
  });

  it('uses H1 for title and grows sections when outline is longer', () => {
    const plan = samplePlan([sampleSection()]);
    const next = applyApprovedOutlineToPlan(plan, [
      { level: 1, text: 'Custom Title' },
      { level: 2, text: 'S1' },
      { level: 3, text: 'S2 nested' },
    ]);
    expect(next.title).toBe('Custom Title');
    expect(next.sections.map((s) => s.heading)).toEqual(['S1', 'S2 nested']);
    expect(next.sections[1].id).toBe('approved-1');
  });

  it('no-ops on empty approved list', () => {
    const plan = samplePlan([sampleSection()]);
    expect(applyApprovedOutlineToPlan(plan, [])).toBe(plan);
  });
});

describe('buildExecutionPlanFromApprovedOutline', () => {
  it('builds a writeable plan when planner canWrite failed (thin KG)', () => {
    const plan = buildExecutionPlanFromApprovedOutline({
      keyword: 'szantaż',
      headings: [
        { level: 1, text: 'Szantaż — przewodnik' },
        { level: 2, text: 'Czym jest szantaż' },
        { level: 2, text: 'Jak reagować' },
      ],
      bundle: {
        intent: {
          keyword: 'szantaż',
          primaryIntent: 'informational',
          articleType: 'guide',
          first60sQuestions: [],
          narrativePreference: 'problem_solution',
          allowBrandNiche: false,
          yearHint: 2026,
        },
        reader: {
          keyword: 'szantaż',
          readerPersona: 'czytelnik',
          goal: 'zrozumieć',
          timeBudgetMinutes: 8,
          knowledgeLevel: 'low',
          desiredOutcome: 'działać',
          tone: 'practical',
          articleType: 'guide',
          fears: [],
          expectedCta: '',
          language: 'pl',
        },
        benchmark: {
          averageWords: 800,
          bestWords: 900,
          averageH2: 4,
          averageParagraphs: 12,
          averageLists: 1,
          averageTables: 0,
          averageImages: 0,
          averageFaq: 0,
          averageClaims: 2,
          averageExamples: 1,
          averageQuestions: 2,
          targetWords: 2200,
          targetH2: 7,
        },
        blueprint: {
          targetWords: 2200,
          targetH2: 7,
          targetParagraphs: 20,
          targetLists: 1,
          targetTables: 0,
          targetImages: 0,
          targetFaqs: 0,
          targetClaims: 2,
          targetQuestions: 2,
          targetExamples: 1,
          targetChecklists: 0,
          requiredSections: [],
          freshness: 'medium',
          budget: {
            words: 2200,
            paragraphs: 20,
            h2: 7,
            lists: 1,
            tables: 0,
            images: 0,
            claims: 2,
            questions: 2,
            examples: 1,
            warnings: 0,
            checklists: 0,
            comparisons: 0,
            faq: 0,
          },
        },
        builtAt: '2026-08-04T12:00:00.000Z',
      },
    });
    expect(plan).not.toBeNull();
    expect(plan!.keyword).toBe('szantaż');
    expect(plan!.title).toBe('Szantaż — przewodnik');
    expect(plan!.sections.map((s) => s.heading)).toEqual(['Czym jest szantaż', 'Jak reagować']);
    expect(plan!.quickAnswer.length).toBeGreaterThan(0);
    expect(plan!.planHash).toHaveLength(32);
    expect(plan!.schemaVersion).toBe(2);
  });

  it('returns null when no body headings', () => {
    expect(buildExecutionPlanFromApprovedOutline({
      keyword: 'x',
      headings: [{ level: 1, text: 'Only H1' }],
    })).toBeNull();
  });
});
