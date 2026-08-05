import type {
  CompiledWritePlan,
  KnowledgeGraphSnapshot,
  KnowledgePack,
  ParagraphPlan,
  PipelineManifest,
} from '../../../lib/contentPlanner/knowledgePack/types';
import { validateRuntime } from '../../../lib/contentPlanner/knowledgePack/validateRuntime';

const manifest: PipelineManifest = {
  plannerVersion: '2',
  compilerVersion: '1',
  validatorVersion: '1',
  writerVersion: '1',
  judgeVersion: '1',
  rendererVersion: '1',
  compiledAt: '2026-08-04T00:00:00Z',
};

const graph: KnowledgeGraphSnapshot = {
  version: '1',
  createdAt: '2026-08-04T00:00:00Z',
  plannerVersion: '2',
  researchVersion: 'none',
  sources: [],
  entities: [],
  claims: [],
  facts: [],
  questions: [],
};

const paragraph: ParagraphPlan = {
  id: 'p1',
  sectionId: 'sec1',
  goal: 'intro',
  expectedWords: 100,
  dependsOnParagraphs: [],
  claims: [],
  facts: [],
  entities: [],
  questions: [],
  keywords: [],
  examples: [],
  sources: [],
  style: {},
  constraints: [],
};

const pack: KnowledgePack = {
  id: 'sec1',
  sectionId: 'sec1',
  heading: 'Section',
  objective: 'Objective',
  priority: 'high',
  expectedWords: 100,
  paragraphPlanIds: ['p1'],
  sectionClaimIds: [],
  sectionFactIds: [],
  sectionEntityIds: [],
  sectionQuestionIds: [],
  sectionSourceIds: [],
  sectionExampleIds: [],
  sectionConstraints: [],
  sectionTransitions: { fromPrevious: null, toNext: null },
};

const basePlan: CompiledWritePlan = {
  planHash: 'hash',
  title: 'Title',
  quickAnswer: 'Quick answer',
  keyword: 'keyword',
  knowledgePacks: [pack],
  paragraphPlans: [paragraph],
  graph,
  manifest,
  diagnostics: {
    warnings: [],
    infos: [],
    metrics: {
      paragraphCount: 1,
      packCount: 1,
      wordBudget: 100,
      coveragePct: 100,
      entityCoveragePct: 100,
    },
  },
};

function malformedPlan(overrides: Record<string, unknown>): CompiledWritePlan {
  return { ...basePlan, ...overrides } as unknown as CompiledWritePlan;
}

function issueCodes(plan: CompiledWritePlan): string[] {
  return validateRuntime(plan).issues.map((entry) => entry.code);
}

describe('validateRuntime', () => {
  it('accepts a Writer-ready plan, including empty graph arrays', () => {
    const result = validateRuntime(basePlan);

    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it.each(['sources', 'entities', 'claims', 'facts', 'questions'] as const)(
    'requires graph.%s to be an array',
    (field) => {
      const result = issueCodes(malformedPlan({ graph: { ...graph, [field]: undefined } }));

      expect(result).toContain('missing_graph_array');
    },
  );

  it('requires at least one paragraph when packs exist', () => {
    expect(issueCodes({ ...basePlan, paragraphPlans: [] })).toContain('empty_paragraph_registry');
  });

  it('requires every pack paragraph id to be loadable from the registry', () => {
    const plan = {
      ...basePlan,
      knowledgePacks: [{ ...pack, paragraphPlanIds: ['missing'] }],
    };

    expect(issueCodes(plan)).toContain('paragraph_not_loadable');
  });

  it.each(Object.keys(manifest) as Array<keyof PipelineManifest>)(
    'requires manifest.%s to be a non-empty string',
    (field) => {
      const result = issueCodes({
        ...basePlan,
        manifest: { ...manifest, [field]: '  ' },
      });

      expect(result).toContain('invalid_manifest_field');
    },
  );

  it.each([
    ['title', { title: '  ' }],
    ['keyword', { keyword: '' }],
  ] as const)('requires a non-empty %s', (field, overrides) => {
    expect(issueCodes({ ...basePlan, ...overrides })).toContain(`missing_${field}`);
  });

  it('accepts well-shaped coverage gaps', () => {
    const result = validateRuntime({
      ...basePlan,
      coverageGaps: [{ text: 'Missing comparison', importance: 'high', covered: false }],
    });

    expect(result.ok).toBe(true);
  });

  it.each([
    { text: '', importance: 'high', covered: false },
    { text: 'Gap', importance: '', covered: false },
    { text: 'Gap', importance: 'high', covered: 'no' },
  ])('rejects malformed coverage gap %#', (gap) => {
    const plan = malformedPlan({ coverageGaps: [gap] });

    expect(issueCodes(plan)).toContain('invalid_coverage_gap');
  });

  it('marks every issue as runtime stage', () => {
    const result = validateRuntime({ ...basePlan, title: '', keyword: '' });

    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.issues.every((entry) => entry.stage === 'runtime')).toBe(true);
  });
});
