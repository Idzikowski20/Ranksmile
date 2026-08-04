import { compileWritePlan, compileAndValidateWritePlan } from '../../../lib/contentPlanner';
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

describe('compileWritePlan', () => {
  it('maps section to knowledge pack with heading, objective, priority, expectedWords', () => {
    const plan = sampleExecutionPlan({
      sections: [sampleSection()],
    });
    const compiled = compileWritePlan(plan);
    const pack = compiled.knowledgePacks[0];
    expect(pack).toBeTruthy();
    expect(pack.heading).toBe('Wprowadzenie');
    expect(pack.objective).toBe('Wprowadź czytelnika w temat.');
    expect(pack.priority).toBe('critical');
    expect(pack.expectedWords).toBe(300);
    expect(pack.sectionId).toBe('sec-intro');
  });

  it('creates paragraph plans with intra-section dependencies (later depend on first)', () => {
    const plan = sampleExecutionPlan({
      sections: [sampleSection({ blocks: ['intro', 'definition', 'summary'] })],
    });
    const compiled = compileWritePlan(plan);
    const paragraphs = compiled.paragraphPlans.filter((p) => p.sectionId === 'sec-intro');
    expect(paragraphs.length).toBeGreaterThanOrEqual(2);
    const first = paragraphs[0];
    const later = paragraphs.slice(1);
    for (const p of later) {
      expect(p.dependsOnParagraphs).toContain(first.id);
    }
    expect(first.dependsOnParagraphs).toEqual([]);
  });

  it('maps claims to verified claims and mirrored facts in the graph', () => {
    const plan = sampleExecutionPlan({
      sections: [sampleSection()],
    });
    const compiled = compileWritePlan(plan);
    const claim = compiled.graph.claims.find((c) => c.id === 'c1');
    expect(claim).toBeTruthy();
    expect(claim?.status).toBe('verified');
    const fact = compiled.graph.facts.find((f) => f.claimId === 'c1');
    expect(fact).toBeTruthy();
    expect(fact?.statement).toBe('SSL jest wymagany.');
  });

  it('maps questions and mustAnswer to graph questions with refs on the first paragraph', () => {
    const plan = sampleExecutionPlan({
      sections: [sampleSection({ mustAnswer: ['Co to jest SEO?', 'Dlaczego SEO?'] })],
    });
    const compiled = compileWritePlan(plan);
    const paragraph = compiled.paragraphPlans.find((p) => p.sectionId === 'sec-intro');
    const questionIds = compiled.graph.questions.map((q) => q.id);
    expect(questionIds.length).toBeGreaterThanOrEqual(2);
    for (const ref of paragraph?.questions ?? []) {
      expect(questionIds).toContain(ref.questionId);
    }
  });

  it('maps checklist block to goal checklist with list style', () => {
    const plan = sampleExecutionPlan({
      sections: [sampleSection({ blocks: ['checklist'] })],
    });
    const compiled = compileWritePlan(plan);
    const paragraph = compiled.paragraphPlans.find((p) => p.sectionId === 'sec-intro');
    expect(paragraph?.goal).toBe('checklist');
    expect(paragraph?.style.list).toBe(true);
  });

  it('maps steps block to goal steps', () => {
    const plan = sampleExecutionPlan({
      sections: [sampleSection({ blocks: ['steps'] })],
    });
    const compiled = compileWritePlan(plan);
    const paragraph = compiled.paragraphPlans.find((p) => p.sectionId === 'sec-intro');
    expect(paragraph?.goal).toBe('steps');
  });

  it('maps faq block to goal faq', () => {
    const plan = sampleExecutionPlan({
      sections: [sampleSection({ blocks: ['faq'] })],
    });
    const compiled = compileWritePlan(plan);
    const paragraph = compiled.paragraphPlans.find((p) => p.sectionId === 'sec-intro');
    expect(paragraph?.goal).toBe('faq');
  });

  it('splits ordinary sections into intro/definition/summary by expectedWords', () => {
    const plan = sampleExecutionPlan({
      sections: [sampleSection({ blocks: ['definition'], expectedWords: 300 })],
    });
    const compiled = compileWritePlan(plan);
    const paragraphs = compiled.paragraphPlans.filter((p) => p.sectionId === 'sec-intro');
    expect(paragraphs.map((p) => p.goal)).toEqual(['intro', 'definition', 'summary']);
    const totalWords = paragraphs.reduce((sum, p) => sum + p.expectedWords, 0);
    expect(totalWords).toBe(300);
  });

  it('round-robin importantTerms onto paragraphs as required keywords', () => {
    const plan = sampleExecutionPlan({
      sections: [sampleSection({ blocks: ['intro', 'definition', 'summary'] })],
    });
    const compiled = compileWritePlan(plan, {
      importantTerms: ['słowo kluczowe', 'link building', 'audyt'],
    });
    const paragraphs = compiled.paragraphPlans.filter((p) => p.sectionId === 'sec-intro');
    const allTerms = paragraphs.flatMap((p) => p.keywords.map((k) => k.term));
    expect(allTerms).toContain('słowo kluczowe');
    expect(allTerms).toContain('link building');
    expect(allTerms).toContain('audyt');
    for (const k of paragraphs.flatMap((p) => p.keywords)) {
      expect(k.required).toBe(true);
    }
  });

  it('allocates all importantTerms even when terms outnumber paragraphs', () => {
    const plan = sampleExecutionPlan({
      sections: [sampleSection({ blocks: ['intro', 'definition', 'summary'] })],
    });
    const compiled = compileWritePlan(plan, {
      importantTerms: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
    });
    const paragraphs = compiled.paragraphPlans.filter((p) => p.sectionId === 'sec-intro');
    const allTerms = paragraphs.flatMap((p) => p.keywords.map((k) => k.term));
    expect(new Set(allTerms).size).toBe(7);
    expect(allTerms).toContain('a');
    expect(allTerms).toContain('g');
    for (const k of paragraphs.flatMap((p) => p.keywords)) {
      expect(k.required).toBe(true);
    }
  });

  it('adds NoBrandMention constraint on non-final packs when allowBrandNiche is false', () => {
    const plan = sampleExecutionPlan({
      sections: [
        sampleSection({ id: 's1', heading: 'A' }),
        sampleSection({ id: 's2', heading: 'B' }),
      ],
    });
    const compiled = compileWritePlan(plan, { allowBrandNiche: false });
    const firstPack = compiled.knowledgePacks[0];
    const lastPack = compiled.knowledgePacks[compiled.knowledgePacks.length - 1];
    expect(firstPack.sectionConstraints.some((c) => c.type === 'NoBrandMention')).toBe(true);
    expect(lastPack.sectionConstraints.some((c) => c.type === 'NoBrandMention')).toBe(false);
  });

  it('leaves transition fields null/empty (no FlowPlanner)', () => {
    const plan = sampleExecutionPlan({
      sections: [sampleSection()],
    });
    const compiled = compileWritePlan(plan);
    const pack = compiled.knowledgePacks[0];
    expect(pack.sectionTransitions.fromPrevious).toBeNull();
    expect(pack.sectionTransitions.toNext).toBeNull();
    for (const p of compiled.paragraphPlans) {
      expect(p.transitionFrom).toBeUndefined();
      expect(p.transitionTo).toBeUndefined();
    }
  });

  it('sets researchVersion to none and manifest compiler version', () => {
    const plan = sampleExecutionPlan({
      sections: [sampleSection()],
    });
    const compiled = compileWritePlan(plan);
    expect(compiled.graph.researchVersion).toBe('none');
    expect(compiled.manifest.compilerVersion).toBe('1');
    expect(compiled.manifest.plannerVersion).toBe('2');
  });

  it('includes diagnostics with metrics and infos', () => {
    const plan = sampleExecutionPlan({
      sections: [sampleSection()],
    });
    const compiled = compileWritePlan(plan);
    expect(compiled.diagnostics.metrics.packCount).toBe(1);
    expect(compiled.diagnostics.metrics.paragraphCount).toBeGreaterThanOrEqual(1);
    expect(compiled.diagnostics.infos.some((i) => i.code === 'pack_count')).toBe(true);
    expect(compiled.diagnostics.infos.some((i) => i.code === 'keyword')).toBe(true);
  });
});

describe('compileAndValidateWritePlan', () => {
  it('returns ok:true for a structurally valid plan', () => {
    const plan = sampleExecutionPlan({
      sections: [sampleSection()],
    });
    const result = compileAndValidateWritePlan(plan);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.plan.planHash).toBeTruthy();
      expect(result.diagnostics.metrics.packCount).toBe(1);
    }
  });

  it('returns ok:false with diagnostics when structural validation fails', () => {
    const plan = sampleExecutionPlan({
      sections: [sampleSection({ id: 's-empty', blocks: [], claims: [], expectedWords: 0 })],
    });
    const result = compileAndValidateWritePlan(plan);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.diagnostics).toBeTruthy();
    }
  });

  it('sets a deterministic planHash based on the compiled plan', () => {
    const plan = sampleExecutionPlan({
      sections: [sampleSection()],
    });
    const a = compileAndValidateWritePlan(plan);
    const b = compileAndValidateWritePlan(plan);
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) {
      expect(a.plan.planHash).toBe(b.plan.planHash);
      expect(a.plan.planHash).toHaveLength(32);
    }
  });
});
