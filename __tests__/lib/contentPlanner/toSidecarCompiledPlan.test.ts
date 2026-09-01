import {
  compileWritePlan,
  toSidecarCompiledPlan,
} from '../../../lib/contentPlanner';
import type {
  ArticleExecutionPlan,
  ExecutionPlanSection,
} from '../../../lib/contentPlanner/types';

function sampleExecutionPlan(partial?: Partial<ArticleExecutionPlan>): ArticleExecutionPlan {
  const base: ArticleExecutionPlan = {
    schemaVersion: 2,
    plannerVersion: '2.0.0',
    planHash: 'hash',
    keyword: 'pozycjonowanie',
    title: 'Jak pozycjonować stronę',
    narrative: 'problem_solution',
    quickAnswer: 'Zacznij od analizy i optymalizacji technicznej.',
    reader: {
      persona: 'właściciel firmy',
      goal: 'zwiększyć widoczność',
      tone: 'praktyczny',
      timeBudgetMinutes: 8,
    },
    articleBudget: {
      words: 2000,
      paragraphs: 40,
      h2: 8,
      lists: 4,
      tables: 1,
      images: 2,
      claims: 6,
      questions: 5,
      examples: 4,
      warnings: 2,
      checklists: 2,
      comparisons: 1,
      faq: 3,
    },
    benchmark: {
      averageWords: 3600,
      bestWords: 3800,
      averageH2: 14,
      averageParagraphs: 90,
      averageLists: 18,
      averageTables: 2,
      averageImages: 4,
      averageFaq: 6,
      averageClaims: 8,
      averageExamples: 8,
      averageQuestions: 6,
      targetWords: 3650,
      targetH2: 14,
    },
    knowledgeCoverage: {
      criticalClaims: { total: 4, assigned: 4, pct: 100 },
      questions: { total: 4, assigned: 4, pct: 100 },
      evidenceNeeds: { total: 2, assigned: 2, pct: 100 },
      knowledgeCoveragePct: 100,
    },
    requiredCoverage: {
      claims: 6,
      questions: 5,
      entities: 5,
      evidence: 2,
      examples: 4,
    },
    sections: [],
    builtAt: new Date().toISOString(),
  };
  return { ...base, ...partial };
}

function sampleSection(partial?: Partial<ExecutionPlanSection>): ExecutionPlanSection {
  const base: ExecutionPlanSection = {
    id: 'sec-intro',
    heading: 'Wprowadzenie',
    objective: 'Wprowadź czytelnika w temat.',
    priority: 'critical',
    expectedWords: 300,
    claims: [
      { id: 'c1', statement: 'SSL jest wymagany.', sources: [] },
      { id: 'c2', statement: 'Mobile-first to standard.', sources: [] },
    ],
    entities: ['SSL', 'Google'],
    questions: ['Co to jest SEO?'],
    mustAnswer: ['Co to jest SEO?', 'Dlaczego SEO jest ważne?'],
    evidence: [{ kind: 'example', hint: 'pokaż przykład' }],
    blocks: ['definition', 'example'],
    budget: {
      words: 300,
      claims: 2,
      entities: 2,
      questions: 2,
      examples: 1,
      lists: 0,
      tables: 0,
      images: 0,
      faq: 0,
      citations: 1,
    },
    writerHints: {
      previousSection: null,
      nextSection: 'Kroki',
      transition: 'Przejdź do działania.',
      tone: 'praktyczny',
      avoidRepeating: [],
    },
  };
  return { ...base, ...partial };
}

describe('toSidecarCompiledPlan', () => {
  it('snake_cases top-level keys', () => {
    const plan = compileWritePlan(sampleExecutionPlan({ sections: [sampleSection()] }));
    const sidecar = toSidecarCompiledPlan(plan);

    expect(sidecar.plan_hash).toBe(plan.planHash);
    expect(sidecar.knowledge_packs).toBeDefined();
    expect(sidecar.paragraph_plans).toBeDefined();
    expect(sidecar.quick_answer).toBe(plan.quickAnswer);
    expect(sidecar).not.toHaveProperty('knowledgePacks');
    expect(sidecar).not.toHaveProperty('paragraphPlans');
  });

  it('snake_cases nested knowledge pack keys', () => {
    const plan = compileWritePlan(sampleExecutionPlan({ sections: [sampleSection()] }));
    const sidecar = toSidecarCompiledPlan(plan);
    const packs = sidecar.knowledge_packs as Record<string, unknown>[];

    expect(packs.length).toBeGreaterThan(0);
    const pack = packs[0];
    expect(pack.paragraph_plan_ids).toEqual(plan.knowledgePacks[0].paragraphPlanIds);
    expect(pack.section_id).toBe(plan.knowledgePacks[0].sectionId);
    expect(pack.section_transitions).toBeDefined();
    expect(pack.section_constraints).toBeDefined();
    expect(pack).not.toHaveProperty('paragraphPlanIds');
    expect(pack).not.toHaveProperty('sectionId');
  });

  it('snake_cases paragraph plan keys including term usage', () => {
    const plan = compileWritePlan(
      sampleExecutionPlan({ sections: [sampleSection()] }),
      { importantTerms: ['słowo kluczowe'] },
    );
    const sidecar = toSidecarCompiledPlan(plan);
    const paragraphs = sidecar.paragraph_plans as Record<string, unknown>[];

    const first = paragraphs[0];
    expect(first.depends_on_paragraphs).toBeDefined();
    expect(first).not.toHaveProperty('dependsOnParagraphs');

    const keywords = first.keywords as Record<string, unknown>[];
    expect(keywords.length).toBeGreaterThan(0);
    const term = keywords[0];
    expect(term.actual_occurrences).toBeDefined();
    expect(term.preferred_paragraphs).toBeDefined();
    expect(term.min_occurrences).toBeDefined();
    expect(term.max_occurrences).toBeDefined();
    expect(term).not.toHaveProperty('actualOccurrences');
    expect(term).not.toHaveProperty('preferredParagraphs');
  });

  it('snake_cases graph, manifest, and diagnostics', () => {
    const plan = compileWritePlan(sampleExecutionPlan({ sections: [sampleSection()] }));
    const sidecar = toSidecarCompiledPlan(plan);

    const graph = sidecar.graph as Record<string, unknown>;
    expect(graph.created_at).toBeDefined();
    expect(graph.research_version).toBeDefined();
    expect(graph.planner_version).toBeDefined();
    expect(graph).not.toHaveProperty('createdAt');

    const manifest = sidecar.manifest as Record<string, unknown>;
    expect(manifest.planner_version).toBeDefined();
    expect(manifest.compiler_version).toBeDefined();
    expect(manifest.compiled_at).toBeDefined();
    expect(manifest).not.toHaveProperty('compiledAt');

    const diagnostics = sidecar.diagnostics as Record<string, unknown>;
    expect(diagnostics.warnings).toBeDefined();
    expect(diagnostics.infos).toBeDefined();
    const metrics = diagnostics.metrics as Record<string, unknown>;
    expect(metrics.paragraph_count).toBeDefined();
    expect(metrics.pack_count).toBeDefined();
    expect(metrics.word_budget).toBeDefined();
    expect(metrics.coverage_pct).toBeDefined();
    expect(metrics.entity_coverage_pct).toBeDefined();
    expect(metrics).not.toHaveProperty('paragraphCount');
  });

  it('preserves primitive values and arrays', () => {
    const plan = compileWritePlan(sampleExecutionPlan({ sections: [sampleSection()] }));
    const sidecar = toSidecarCompiledPlan(plan);

    expect(sidecar.plan_hash).toBe(plan.planHash);
    expect(sidecar.title).toBe(plan.title);
    expect(sidecar.keyword).toBe(plan.keyword);
    expect(Array.isArray(sidecar.knowledge_packs)).toBe(true);
    expect(Array.isArray(sidecar.paragraph_plans)).toBe(true);
  });

  it('round-trips through JSON without losing snake_case shape', () => {
    const plan = compileWritePlan(sampleExecutionPlan({ sections: [sampleSection()] }));
    const sidecar = toSidecarCompiledPlan(plan);
    const round = JSON.parse(JSON.stringify(sidecar)) as Record<string, unknown>;

    expect(round.plan_hash).toBe(plan.planHash);
    expect(Array.isArray(round.knowledge_packs)).toBe(true);
    expect(Array.isArray(round.paragraph_plans)).toBe(true);
  });
});
