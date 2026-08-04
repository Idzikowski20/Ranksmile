import type {
  CompiledWritePlan,
  KnowledgeGraphSnapshot,
  KnowledgePack,
  PackValidationResult,
  ParagraphGoal,
  ParagraphPlan,
  PipelineManifest,
} from '../../../lib/contentPlanner/knowledgePack/types';
import { validateSemantic } from '../../../lib/contentPlanner/knowledgePack/validateSemantic';

const emptyManifest: PipelineManifest = {
  plannerVersion: '1',
  compilerVersion: '1',
  validatorVersion: '1',
  writerVersion: '1',
  judgeVersion: '1',
  rendererVersion: '1',
  compiledAt: '2026-08-04T00:00:00Z',
};

const baseGraph: KnowledgeGraphSnapshot = {
  version: '1',
  createdAt: '2026-08-04T00:00:00Z',
  plannerVersion: '1',
  researchVersion: 'none',
  sources: [],
  entities: [],
  claims: [],
  facts: [],
  questions: [],
};

function paragraph(
  id: string,
  goal: ParagraphGoal,
  expectedWords: number,
  overrides?: Partial<ParagraphPlan>,
): ParagraphPlan {
  return {
    id,
    sectionId: `sec-${id}`,
    goal,
    expectedWords,
    dependsOnParagraphs: [],
    claims: [],
    facts: [],
    entities: [],
    questions: [],
    keywords: [],
    examples: [],
    sources: [],
    transitionFrom: undefined,
    transitionTo: undefined,
    style: {},
    constraints: [],
    ...overrides,
  };
}

function pack(
  id: string,
  paragraphPlanIds: string[],
  expectedWords: number,
  overrides?: Partial<KnowledgePack>,
): KnowledgePack {
  return {
    id,
    sectionId: id,
    heading: id,
    objective: 'Objective',
    priority: 'high',
    expectedWords,
    paragraphPlanIds,
    sectionClaimIds: [],
    sectionFactIds: [],
    sectionEntityIds: [],
    sectionQuestionIds: [],
    sectionSourceIds: [],
    sectionExampleIds: [],
    sectionConstraints: [],
    sectionTransitions: { fromPrevious: null, toNext: null },
    ...overrides,
  };
}

function plan(packs: KnowledgePack[], paragraphs: ParagraphPlan[]): CompiledWritePlan {
  return {
    planHash: 'hash',
    title: 'Title',
    quickAnswer: 'Quick answer',
    keyword: 'keyword',
    knowledgePacks: packs,
    paragraphPlans: paragraphs,
    graph: baseGraph,
    manifest: emptyManifest,
    diagnostics: {
      warnings: [],
      infos: [],
      metrics: {
        paragraphCount: paragraphs.length,
        packCount: packs.length,
        wordBudget: packs.reduce((sum, p) => sum + p.expectedWords, 0),
        coveragePct: 100,
        entityCoveragePct: 100,
      },
    },
  };
}

function issueCodes(result: PackValidationResult): string[] {
  return result.issues.map((i) => i.code);
}

function issuesForCode(result: PackValidationResult, code: string) {
  return result.issues.filter((i) => i.code === code);
}

describe('validateSemantic', () => {
  it('returns ok for a valid multi-pack plan', () => {
    const p1 = paragraph('p1', 'intro', 100, { transitionTo: 'Continue to context.' });
    const p2 = paragraph('p2', 'context', 120, {
      transitionFrom: 'Continuing from intro.',
      transitionTo: 'Next, the problem.',
    });
    const p3 = paragraph('p3', 'problem', 90, {
      dependsOnParagraphs: ['p1'],
      transitionFrom: 'Context leads to problem.',
    });
    const sec1 = pack('sec1', ['p1', 'p2'], 220, {
      sectionTransitions: { fromPrevious: null, toNext: 'Then problem.' },
    });
    const sec2 = pack('sec2', ['p3'], 90, {
      sectionTransitions: { fromPrevious: 'After context.', toNext: null },
    });
    const result = validateSemantic(plan([sec1, sec2], [p1, p2, p3]));
    expect(result.ok).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('errors when a paragraph has expectedWords <= 0', () => {
    const p1 = paragraph('p1', 'intro', 0);
    const sec1 = pack('sec1', ['p1'], 100);
    const result = validateSemantic(plan([sec1], [p1]));
    expect(result.ok).toBe(false);
    expect(issueCodes(result)).toContain('invalid_expected_words');
  });

  it('errors when an orphan paragraph has expectedWords <= 0', () => {
    const p1 = paragraph('p1', 'intro', 100);
    const orphan = paragraph('orphan', 'context', 0);
    const sec1 = pack('sec1', ['p1'], 100);
    const result = validateSemantic(plan([sec1], [p1, orphan]));
    expect(result.ok).toBe(false);
    expect(issueCodes(result)).toContain('invalid_expected_words');
    expect(issuesForCode(result, 'invalid_expected_words').some((i) => i.paragraphId === 'orphan')).toBe(true);
  });

  it('errors when a pack has expectedWords <= 0', () => {
    const p1 = paragraph('p1', 'intro', 100);
    const sec1 = pack('sec1', ['p1'], 0);
    const result = validateSemantic(plan([sec1], [p1]));
    expect(result.ok).toBe(false);
    expect(issueCodes(result)).toContain('invalid_expected_words');
  });

  it('errors when paragraph word sum exceeds 15% of pack budget', () => {
    const p1 = paragraph('p1', 'intro', 60);
    const p2 = paragraph('p2', 'context', 60);
    const sec1 = pack('sec1', ['p1', 'p2'], 100);
    const result = validateSemantic(plan([sec1], [p1, p2]));
    expect(result.ok).toBe(false);
    expect(issueCodes(result)).toContain('word_budget_mismatch');
  });

  it('errors when paragraph word sum is more than 15% below pack budget', () => {
    const p1 = paragraph('p1', 'intro', 30);
    const p2 = paragraph('p2', 'context', 30);
    const sec1 = pack('sec1', ['p1', 'p2'], 100);
    const result = validateSemantic(plan([sec1], [p1, p2]));
    expect(result.ok).toBe(false);
    expect(issueCodes(result)).toContain('word_budget_mismatch');
  });

  it('allows paragraph word sum within 15% of pack budget', () => {
    const p1 = paragraph('p1', 'intro', 55);
    const p2 = paragraph('p2', 'context', 55);
    const sec1 = pack('sec1', ['p1', 'p2'], 100);
    const result = validateSemantic(plan([sec1], [p1, p2]));
    expect(issueCodes(result)).not.toContain('word_budget_mismatch');
  });

  it('errors on consecutive duplicate paragraph goals in the same pack', () => {
    const p1 = paragraph('p1', 'faq', 50);
    const p2 = paragraph('p2', 'faq', 50);
    const sec1 = pack('sec1', ['p1', 'p2'], 100);
    const result = validateSemantic(plan([sec1], [p1, p2]));
    expect(result.ok).toBe(false);
    expect(issueCodes(result)).toContain('duplicate_consecutive_goal');
  });

  it('errors on any consecutive duplicate goal, not just faq/cta', () => {
    const p1 = paragraph('p1', 'intro', 50);
    const p2 = paragraph('p2', 'intro', 50);
    const sec1 = pack('sec1', ['p1', 'p2'], 100);
    const result = validateSemantic(plan([sec1], [p1, p2]));
    expect(result.ok).toBe(false);
    expect(issueCodes(result)).toContain('duplicate_consecutive_goal');
  });

  it('errors when a middle pack is missing fromPrevious transition', () => {
    const p1 = paragraph('p1', 'intro', 100);
    const p2 = paragraph('p2', 'context', 100);
    const sec1 = pack('sec1', ['p1'], 100, {
      sectionTransitions: { fromPrevious: null, toNext: 'To sec2.' },
    });
    const sec2 = pack('sec2', ['p2'], 100, {
      sectionTransitions: { fromPrevious: null, toNext: 'To sec3.' },
    });
    const sec3 = pack('sec3', [], 100, {
      sectionTransitions: { fromPrevious: 'From sec2.', toNext: null },
    });
    const result = validateSemantic(plan([sec1, sec2, sec3], [p1, p2]));
    expect(result.ok).toBe(false);
    expect(issueCodes(result)).toContain('missing_section_transition');
    const missingFromPrevious = issuesForCode(result, 'missing_section_transition').some(
      (i) => i.packId === 'sec2' && i.message.includes('fromPrevious'),
    );
    expect(missingFromPrevious).toBe(true);
  });

  it('errors when a middle pack is missing toNext transition', () => {
    const p1 = paragraph('p1', 'intro', 100);
    const p2 = paragraph('p2', 'context', 100);
    const sec1 = pack('sec1', ['p1'], 100, {
      sectionTransitions: { fromPrevious: null, toNext: 'To sec2.' },
    });
    const sec2 = pack('sec2', ['p2'], 100, {
      sectionTransitions: { fromPrevious: 'From sec1.', toNext: null },
    });
    const sec3 = pack('sec3', [], 100, {
      sectionTransitions: { fromPrevious: 'From sec2.', toNext: null },
    });
    const result = validateSemantic(plan([sec1, sec2, sec3], [p1, p2]));
    expect(result.ok).toBe(false);
    expect(issueCodes(result)).toContain('missing_section_transition');
    const missingToNext = issuesForCode(result, 'missing_section_transition').some(
      (i) => i.packId === 'sec2' && i.message.includes('toNext'),
    );
    expect(missingToNext).toBe(true);
  });

  it('allows first and last pack section transitions to be null', () => {
    const p1 = paragraph('p1', 'intro', 100);
    const sec1 = pack('sec1', ['p1'], 100, {
      sectionTransitions: { fromPrevious: null, toNext: null },
    });
    const result = validateSemantic(plan([sec1], [p1]));
    expect(result.ok).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('errors when a dependency points to a later paragraph in the same pack', () => {
    const p1 = paragraph('p1', 'intro', 100);
    // p2 depends on p3, which is later in the same pack
    const p2 = paragraph('p2', 'context', 100, { dependsOnParagraphs: ['p3'] });
    const p3 = paragraph('p3', 'problem', 100);
    const sec1 = pack('sec1', ['p1', 'p2', 'p3'], 300);
    const result = validateSemantic(plan([sec1], [p1, p2, p3]));
    expect(result.ok).toBe(false);
    expect(issueCodes(result)).toContain('cyclic_dependency');
  });

  it('errors when a dependency points to a paragraph in a later pack', () => {
    const p1 = paragraph('p1', 'intro', 100);
    const p2 = paragraph('p2', 'context', 100, { dependsOnParagraphs: ['p3'] });
    const p3 = paragraph('p3', 'problem', 100);
    const sec1 = pack('sec1', ['p1', 'p2'], 200, {
      sectionTransitions: { fromPrevious: null, toNext: 'To sec2.' },
    });
    const sec2 = pack('sec2', ['p3'], 100, {
      sectionTransitions: { fromPrevious: 'From sec1.', toNext: null },
    });
    const result = validateSemantic(plan([sec1, sec2], [p1, p2, p3]));
    expect(result.ok).toBe(false);
    expect(issueCodes(result)).toContain('cyclic_dependency');
  });

  it('allows dependencies on earlier paragraphs in the same pack', () => {
    const p1 = paragraph('p1', 'intro', 100);
    const p2 = paragraph('p2', 'context', 100, { dependsOnParagraphs: ['p1'] });
    const sec1 = pack('sec1', ['p1', 'p2'], 200);
    const result = validateSemantic(plan([sec1], [p1, p2]));
    expect(issueCodes(result)).not.toContain('cyclic_dependency');
  });

  it('allows dependencies on paragraphs from earlier packs', () => {
    const p1 = paragraph('p1', 'intro', 100);
    const p2 = paragraph('p2', 'context', 100, { dependsOnParagraphs: ['p1'] });
    const sec1 = pack('sec1', ['p1'], 100, {
      sectionTransitions: { fromPrevious: null, toNext: 'To sec2.' },
    });
    const sec2 = pack('sec2', ['p2'], 100, {
      sectionTransitions: { fromPrevious: 'From sec1.', toNext: null },
    });
    const result = validateSemantic(plan([sec1, sec2], [p1, p2]));
    expect(result.ok).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('errors on a direct dependency cycle within the same pack', () => {
    const p1 = paragraph('p1', 'intro', 100, { dependsOnParagraphs: ['p2'] });
    const p2 = paragraph('p2', 'context', 100, { dependsOnParagraphs: ['p1'] });
    const sec1 = pack('sec1', ['p1', 'p2'], 200);
    const result = validateSemantic(plan([sec1], [p1, p2]));
    expect(result.ok).toBe(false);
    expect(issueCodes(result)).toContain('cyclic_dependency');
  });

  it('errors on a self-dependency', () => {
    const p1 = paragraph('p1', 'intro', 100, { dependsOnParagraphs: ['p1'] });
    const sec1 = pack('sec1', ['p1'], 100);
    const result = validateSemantic(plan([sec1], [p1]));
    expect(result.ok).toBe(false);
    expect(issueCodes(result)).toContain('cyclic_dependency');
  });

  it('errors when a middle paragraph is missing transitionFrom', () => {
    const p1 = paragraph('p1', 'intro', 100, { transitionTo: 'To context.' });
    const p2 = paragraph('p2', 'context', 100, { transitionFrom: undefined, transitionTo: 'To problem.' });
    const p3 = paragraph('p3', 'problem', 100, { transitionFrom: 'From context.' });
    const sec1 = pack('sec1', ['p1', 'p2', 'p3'], 300);
    const result = validateSemantic(plan([sec1], [p1, p2, p3]));
    expect(result.ok).toBe(false);
    expect(issueCodes(result)).toContain('missing_paragraph_transition_from');
    expect(issuesForCode(result, 'missing_paragraph_transition_from')[0].paragraphId).toBe('p2');
  });

  it('errors when a middle paragraph is missing transitionTo', () => {
    const p1 = paragraph('p1', 'intro', 100, { transitionTo: 'To context.' });
    const p2 = paragraph('p2', 'context', 100, { transitionFrom: 'From intro.', transitionTo: undefined });
    const p3 = paragraph('p3', 'problem', 100, { transitionFrom: 'From context.' });
    const sec1 = pack('sec1', ['p1', 'p2', 'p3'], 300);
    const result = validateSemantic(plan([sec1], [p1, p2, p3]));
    expect(result.ok).toBe(false);
    expect(issueCodes(result)).toContain('missing_paragraph_transition_to');
  });

  it('allows first paragraph transitionFrom and last paragraph transitionTo to be missing', () => {
    const p1 = paragraph('p1', 'intro', 100, { transitionFrom: undefined, transitionTo: 'To context.' });
    const p2 = paragraph('p2', 'context', 100, { transitionFrom: 'From intro.', transitionTo: undefined });
    const sec1 = pack('sec1', ['p1', 'p2'], 200);
    const result = validateSemantic(plan([sec1], [p1, p2]));
    expect(result.ok).toBe(true);
    expect(result.issues).toHaveLength(0);
  });
});
