import * as contentPlanner from '../../../lib/contentPlanner';
import * as knowledgePackTypes from '../../../lib/contentPlanner/knowledgePack/types';
import {
  PIPELINE_COMPONENT_VERSIONS,
} from '../../../lib/contentPlanner/knowledgePack/types';
import type {
  CompileDiagnostics,
  CompiledWritePlan,
  KnowledgeGraphSnapshot,
  KnowledgePack,
  PipelineManifest,
} from '../../../lib/contentPlanner/knowledgePack/types';

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

const emptyDiagnostics = (): CompileDiagnostics => ({
  warnings: [],
  infos: [],
  metrics: {
    paragraphCount: 0,
    packCount: 0,
    wordBudget: 0,
    coveragePct: 100,
    entityCoveragePct: 100,
  },
});

describe('knowledgePack types', () => {
  it('PIPELINE_COMPONENT_VERSIONS pins all pipeline stages', () => {
    expect(PIPELINE_COMPONENT_VERSIONS).toEqual({
      planner: '2',
      compiler: '1',
      validator: '1',
      writer: '1',
      judge: '1',
      renderer: '1',
    });
  });

  it('KnowledgePack holds paragraphPlanIds only (no nested paragraphs)', () => {
    const pack: KnowledgePack = {
      id: 'kp-1',
      sectionId: 'sec-1',
      heading: 'Wprowadzenie',
      objective: 'Zainteresuj czytelnika',
      priority: 'high',
      expectedWords: 200,
      paragraphPlanIds: ['p-1', 'p-2'],
      sectionClaimIds: [],
      sectionFactIds: [],
      sectionEntityIds: [],
      sectionQuestionIds: [],
      sectionSourceIds: [],
      sectionExampleIds: [],
      sectionConstraints: [],
      sectionTransitions: { fromPrevious: null, toNext: 'Następna sekcja' },
    };
    expect(pack.paragraphPlanIds).toEqual(['p-1', 'p-2']);
    expect('paragraphs' in pack).toBe(false);
    expect('paragraphInstructions' in pack).toBe(false);
    expect('mustUseTerms' in pack).toBe(false);
    expect('forbidden' in pack).toBe(false);
  });

  it('CompiledWritePlan requires diagnostics on every compile artifact', () => {
    const manifest: PipelineManifest = {
      plannerVersion: PIPELINE_COMPONENT_VERSIONS.planner,
      compilerVersion: PIPELINE_COMPONENT_VERSIONS.compiler,
      validatorVersion: PIPELINE_COMPONENT_VERSIONS.validator,
      writerVersion: PIPELINE_COMPONENT_VERSIONS.writer,
      judgeVersion: PIPELINE_COMPONENT_VERSIONS.judge,
      rendererVersion: PIPELINE_COMPONENT_VERSIONS.renderer,
      compiledAt: '2026-08-04T12:00:00.000Z',
    };
    const diagnostics = emptyDiagnostics();
    const plan: CompiledWritePlan = {
      planHash: 'hash-1',
      title: 'Test article',
      quickAnswer: 'Krótka odpowiedź.',
      keyword: 'test',
      knowledgePacks: [],
      paragraphPlans: [],
      graph: emptyGraph(),
      manifest,
      diagnostics,
    };
    expect(plan.diagnostics).toBe(diagnostics);
    expect(plan.diagnostics.metrics.packCount).toBe(0);
  });

  it('does not export WriteEngineInput alias', () => {
    expect('WriteEngineInput' in knowledgePackTypes).toBe(false);
    expect('WriteEngineInput' in contentPlanner).toBe(false);
  });

  it('re-exports key symbols from contentPlanner index', () => {
    expect(contentPlanner.PIPELINE_COMPONENT_VERSIONS).toBe(PIPELINE_COMPONENT_VERSIONS);
  });
});
