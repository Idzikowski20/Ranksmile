import { buildCompileDiagnostics } from '../../../lib/contentPlanner/knowledgePack/compileDiagnostics';
import { PIPELINE_COMPONENT_VERSIONS } from '../../../lib/contentPlanner/knowledgePack/types';
import type {
  CompiledWritePlan,
  KnowledgeGraphSnapshot,
  KnowledgePack,
  ParagraphPlan,
  PipelineManifest,
} from '../../../lib/contentPlanner/knowledgePack/types';

const manifest = (): PipelineManifest => ({
  plannerVersion: PIPELINE_COMPONENT_VERSIONS.planner,
  compilerVersion: PIPELINE_COMPONENT_VERSIONS.compiler,
  validatorVersion: PIPELINE_COMPONENT_VERSIONS.validator,
  writerVersion: PIPELINE_COMPONENT_VERSIONS.writer,
  judgeVersion: PIPELINE_COMPONENT_VERSIONS.judge,
  rendererVersion: PIPELINE_COMPONENT_VERSIONS.renderer,
  compiledAt: '2026-08-04T12:00:00.000Z',
});

const emptyGraph = (): KnowledgeGraphSnapshot => ({
  version: '1',
  createdAt: '2026-08-04T00:00:00.000Z',
  plannerVersion: PIPELINE_COMPONENT_VERSIONS.planner,
  researchVersion: 'none',
  sources: [],
  entities: [],
  claims: [],
  facts: [],
  questions: [],
});

const basePlan = (
  overrides: Partial<Omit<CompiledWritePlan, 'diagnostics'>> = {},
): Omit<CompiledWritePlan, 'diagnostics'> => ({
  planHash: 'hash-1',
  title: 'Test article',
  quickAnswer: 'Krótka odpowiedź.',
  keyword: 'seo keyword',
  knowledgePacks: [],
  paragraphPlans: [],
  graph: emptyGraph(),
  manifest: manifest(),
  ...overrides,
});

const paragraph = (overrides: Partial<ParagraphPlan> & Pick<ParagraphPlan, 'id'>): ParagraphPlan => ({
  id: overrides.id,
  sectionId: overrides.sectionId ?? 'sec-1',
  goal: overrides.goal ?? 'intro',
  expectedWords: overrides.expectedWords ?? 100,
  dependsOnParagraphs: overrides.dependsOnParagraphs ?? [],
  claims: overrides.claims ?? [],
  facts: overrides.facts ?? [],
  entities: overrides.entities ?? [],
  questions: overrides.questions ?? [],
  keywords: overrides.keywords ?? [],
  examples: overrides.examples ?? [],
  sources: overrides.sources ?? [],
  style: overrides.style ?? {},
  constraints: overrides.constraints ?? [],
});

const pack = (overrides: Partial<KnowledgePack> & Pick<KnowledgePack, 'id'>): KnowledgePack => ({
  id: overrides.id,
  sectionId: overrides.sectionId ?? 'sec-1',
  heading: overrides.heading ?? 'Sekcja',
  objective: overrides.objective ?? 'Cel',
  priority: overrides.priority ?? 'high',
  expectedWords: overrides.expectedWords ?? 200,
  paragraphPlanIds: overrides.paragraphPlanIds ?? [],
  sectionClaimIds: overrides.sectionClaimIds ?? [],
  sectionFactIds: overrides.sectionFactIds ?? [],
  sectionEntityIds: overrides.sectionEntityIds ?? [],
  sectionQuestionIds: overrides.sectionQuestionIds ?? [],
  sectionSourceIds: overrides.sectionSourceIds ?? [],
  sectionExampleIds: overrides.sectionExampleIds ?? [],
  sectionConstraints: overrides.sectionConstraints ?? [],
  sectionTransitions: overrides.sectionTransitions ?? { fromPrevious: null, toNext: null },
});

describe('buildCompileDiagnostics', () => {
  it('computes metrics from plan shape', () => {
    const plan = basePlan({
      knowledgePacks: [
        pack({ id: 'kp-1', expectedWords: 300 }),
        pack({ id: 'kp-2', expectedWords: 400 }),
      ],
      paragraphPlans: [
        paragraph({ id: 'p-1', expectedWords: 120, entities: [{ entityId: 'e-1' }] }),
        paragraph({ id: 'p-2', expectedWords: 80, questions: [{ questionId: 'q-1' }] }),
      ],
      graph: {
        ...emptyGraph(),
        entities: [
          { id: 'e-1', name: 'Entity 1', kind: 'concept', aliases: [] },
          { id: 'e-2', name: 'Entity 2', kind: 'concept', aliases: [] },
        ],
        questions: [
          { id: 'q-1', text: 'Q1?' },
          { id: 'q-2', text: 'Q2?' },
        ],
      },
    });

    const diagnostics = buildCompileDiagnostics(plan);

    expect(diagnostics.metrics).toEqual({
      paragraphCount: 2,
      packCount: 2,
      wordBudget: 200,
      coveragePct: 50,
      entityCoveragePct: 50,
    });
    expect(diagnostics).not.toHaveProperty('ok');
  });

  it('uses 100% coverage when graph has no questions or entities', () => {
    const diagnostics = buildCompileDiagnostics(basePlan());

    expect(diagnostics.metrics.coveragePct).toBe(100);
    expect(diagnostics.metrics.entityCoveragePct).toBe(100);
  });

  it('warns pack_small_budget when pack expectedWords < 150', () => {
    const plan = basePlan({
      knowledgePacks: [pack({ id: 'kp-small', expectedWords: 100 })],
    });

    const diagnostics = buildCompileDiagnostics(plan);

    expect(diagnostics.warnings).toContainEqual({
      level: 'warning',
      code: 'pack_small_budget',
      message: expect.stringContaining('100'),
      packId: 'kp-small',
    });
  });

  it('warns missing_transition on middle pack without both transitions', () => {
    const plan = basePlan({
      knowledgePacks: [
        pack({
          id: 'kp-first',
          sectionTransitions: { fromPrevious: null, toNext: 'Next' },
        }),
        pack({
          id: 'kp-middle',
          sectionTransitions: { fromPrevious: null, toNext: 'After middle' },
        }),
        pack({
          id: 'kp-last',
          sectionTransitions: { fromPrevious: 'Prev', toNext: null },
        }),
      ],
    });

    const diagnostics = buildCompileDiagnostics(plan);

    expect(diagnostics.warnings).toContainEqual({
      level: 'warning',
      code: 'missing_transition',
      message: expect.stringContaining('kp-middle'),
      packId: 'kp-middle',
    });
    expect(
      diagnostics.warnings.filter((w) => w.code === 'missing_transition').map((w) => w.packId),
    ).toEqual(['kp-middle']);
  });

  it('warns term_unassigned for required terms without preferredParagraphs', () => {
    const plan = basePlan({
      paragraphPlans: [
        paragraph({
          id: 'p-1',
          keywords: [
            {
              term: 'must-use',
              importance: 'critical',
              minOccurrences: 1,
              maxOccurrences: 3,
              preferredParagraphs: [],
              required: true,
              actualOccurrences: null,
            },
          ],
        }),
      ],
    });

    const diagnostics = buildCompileDiagnostics(plan);

    expect(diagnostics.warnings).toContainEqual({
      level: 'warning',
      code: 'term_unassigned',
      message: expect.stringContaining('must-use'),
      paragraphId: 'p-1',
    });
  });

  it('emits infos for packCount and keyword', () => {
    const plan = basePlan({
      keyword: 'content marketing',
      knowledgePacks: [pack({ id: 'kp-1' }), pack({ id: 'kp-2' })],
    });

    const diagnostics = buildCompileDiagnostics(plan);

    expect(diagnostics.infos).toContainEqual({
      level: 'info',
      code: 'pack_count',
      message: expect.stringContaining('2'),
    });
    expect(diagnostics.infos).toContainEqual({
      level: 'info',
      code: 'keyword',
      message: expect.stringContaining('content marketing'),
    });
  });
});
