import type {
  ClaimStatus,
  CompiledWritePlan,
  KnowledgeGraphSnapshot,
  KnowledgePack,
  ParagraphPlan,
  PipelineManifest,
} from '../../../lib/contentPlanner/knowledgePack/types';
import { validateStructural } from '../../../lib/contentPlanner/knowledgePack/validateStructural';

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
  sources: [{ id: 's1', url: 'https://example.com', domain: 'example.com', authority: 0.8, language: 'en', title: 'Example', summary: 'summary', claimIds: ['c1'], entityIds: ['e1'], quotes: [] }],
  entities: [{ id: 'e1', name: 'Entity', kind: 'concept', aliases: [] }],
  claims: [{ id: 'c1', text: 'Claim', sourceId: 's1', confidence: 0.9, status: 'verified' }],
  facts: [{ id: 'f1', claimId: 'c1', statement: 'Fact', confidence: 0.9 }],
  questions: [{ id: 'q1', text: 'Question?' }],
};

const baseParagraph: ParagraphPlan = {
  id: 'p1',
  sectionId: 'sec1',
  goal: 'intro',
  expectedWords: 100,
  dependsOnParagraphs: [],
  claims: [{ claimId: 'c1' }],
  facts: [{ factId: 'f1' }],
  entities: [{ entityId: 'e1' }],
  questions: [{ questionId: 'q1' }],
  keywords: [],
  examples: [],
  sources: [{ sourceId: 's1' }],
  style: {},
  constraints: [],
};

const basePack: KnowledgePack = {
  id: 'sec1',
  sectionId: 'sec1',
  heading: 'Section',
  objective: 'Objective',
  priority: 'high',
  expectedWords: 100,
  paragraphPlanIds: ['p1'],
  sectionClaimIds: ['c1'],
  sectionFactIds: ['f1'],
  sectionEntityIds: ['e1'],
  sectionQuestionIds: ['q1'],
  sectionSourceIds: ['s1'],
  sectionExampleIds: [],
  sectionConstraints: [],
  sectionTransitions: { fromPrevious: null, toNext: null },
};

const basePlan: CompiledWritePlan = {
  planHash: 'hash',
  title: 'Title',
  quickAnswer: 'Quick answer',
  keyword: 'keyword',
  knowledgePacks: [basePack],
  paragraphPlans: [baseParagraph],
  graph: baseGraph,
  manifest: emptyManifest,
  diagnostics: { warnings: [], infos: [], metrics: { paragraphCount: 1, packCount: 1, wordBudget: 100, coveragePct: 100, entityCoveragePct: 100 } },
};

function issueCodes(plan: CompiledWritePlan): string[] {
  return validateStructural(plan).issues.map((i) => i.code);
}

describe('validateStructural', () => {
  it('returns ok for a valid plan', () => {
    const result = validateStructural(basePlan);
    expect(result.ok).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('errors when a pack references a missing paragraph plan', () => {
    const plan: CompiledWritePlan = {
      ...basePlan,
      knowledgePacks: [{ ...basePack, paragraphPlanIds: ['p1', 'missing'] }],
    };
    const result = validateStructural(plan);
    expect(result.ok).toBe(false);
    expect(issueCodes(plan)).toContain('missing_paragraph');
  });

  it('errors when a paragraph has a claim ref that does not resolve in graph', () => {
    const plan: CompiledWritePlan = {
      ...basePlan,
      paragraphPlans: [{ ...baseParagraph, claims: [{ claimId: 'missing' }] }],
    };
    expect(issueCodes(plan)).toContain('unresolved_claim');
  });

  it('errors when a paragraph has a fact ref that does not resolve in graph', () => {
    const plan: CompiledWritePlan = {
      ...basePlan,
      paragraphPlans: [{ ...baseParagraph, facts: [{ factId: 'missing' }] }],
    };
    expect(issueCodes(plan)).toContain('unresolved_fact');
  });

  it('errors when a paragraph has an entity ref that does not resolve in graph', () => {
    const plan: CompiledWritePlan = {
      ...basePlan,
      paragraphPlans: [{ ...baseParagraph, entities: [{ entityId: 'missing' }] }],
    };
    expect(issueCodes(plan)).toContain('unresolved_entity');
  });

  it('errors when a paragraph has a source ref that does not resolve in graph', () => {
    const plan: CompiledWritePlan = {
      ...basePlan,
      paragraphPlans: [{ ...baseParagraph, sources: [{ sourceId: 'missing' }] }],
    };
    expect(issueCodes(plan)).toContain('unresolved_source');
  });

  it('errors when a paragraph has a question ref that does not resolve in graph', () => {
    const plan: CompiledWritePlan = {
      ...basePlan,
      paragraphPlans: [{ ...baseParagraph, questions: [{ questionId: 'missing' }] }],
    };
    expect(issueCodes(plan)).toContain('unresolved_question');
  });

  it('errors when a fact claimId does not resolve to a claim', () => {
    const plan: CompiledWritePlan = {
      ...basePlan,
      graph: {
        ...baseGraph,
        facts: [{ id: 'f1', claimId: 'missing', statement: 'Fact', confidence: 0.9 }],
      },
    };
    expect(issueCodes(plan)).toContain('fact_claim_missing');
  });

  it('errors when a claim status is not a valid enum value', () => {
    const plan: CompiledWritePlan = {
      ...basePlan,
      graph: {
        ...baseGraph,
        claims: [{ id: 'c1', text: 'Claim', sourceId: 's1', confidence: 0.9, status: 'invalid' as ClaimStatus }],
      },
    };
    expect(issueCodes(plan)).toContain('invalid_claim_status');
  });

  it('errors when dependsOnParagraphs references a missing paragraph', () => {
    const plan: CompiledWritePlan = {
      ...basePlan,
      paragraphPlans: [{ ...baseParagraph, dependsOnParagraphs: ['missing'] }],
    };
    expect(issueCodes(plan)).toContain('missing_dependency');
  });

  it('errors when a pack id is empty', () => {
    const plan: CompiledWritePlan = {
      ...basePlan,
      knowledgePacks: [{ ...basePack, id: '' }],
    };
    expect(issueCodes(plan)).toContain('empty_pack_id');
  });

  it('errors when a paragraph id is empty', () => {
    const plan: CompiledWritePlan = {
      ...basePlan,
      paragraphPlans: [{ ...baseParagraph, id: '' }],
    };
    expect(issueCodes(plan)).toContain('empty_paragraph_id');
  });

  it('errors when a pack has empty paragraphPlanIds', () => {
    const plan: CompiledWritePlan = {
      ...basePlan,
      knowledgePacks: [{ ...basePack, paragraphPlanIds: [] }],
    };
    expect(issueCodes(plan)).toContain('empty_pack');
  });
});
