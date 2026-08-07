/**
 * Planner First — Plan Validator + Article Execution Plan gates.
 */
import {
  buildArticleExecutionPlan,
  computeKnowledgeCoverage,
  finalizePlannerForWrite,
  hashExecutionPlanPayload,
  runContentPlanner,
  toSidecarExecutionPlan,
  validateAgainstBenchmark,
  validateKnowledgeCoverageGate,
  validatePlanConformity,
  validatePlanForWrite,
  KNOWLEDGE_COVERAGE_MIN_PCT,
} from '../../../lib/contentPlanner';
import type {
  AdaptiveOutline,
  ArticleBlueprint,
  CompetitorBenchmark,
  KnowledgeCoverageReport,
  SectionBrief,
  TargetKnowledgeGraph,
} from '../../../lib/contentPlanner/types';

function sampleBrief(partial?: Partial<SectionBrief>): SectionBrief {
  return {
    sectionId: 'sec-0',
    heading: 'Quick Answer',
    objective: 'Give value fast',
    claimIds: ['c1'],
    questionIds: ['q1'],
    blocks: ['steps', 'example'],
    evidence: [{ kind: 'example', hint: 'demo' }],
    budget: {
      words: 300,
      claims: 1,
      entities: 2,
      questions: 1,
      examples: 1,
      lists: 1,
      tables: 0,
      images: 0,
      faq: 0,
      citations: 1,
    },
    freshnessNotes: [],
    mustAnswer: ['Jak zacząć?'],
    sectionPriority: 'critical',
    writerHints: {
      previousSection: null,
      nextSection: 'Quick Wins',
      transition: 'Start action-first',
      tone: 'practical',
      avoidRepeating: [],
    },
    ...partial,
  };
}

const benchmark: CompetitorBenchmark = {
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
};

const blueprintOk: ArticleBlueprint = {
  targetWords: 3650,
  targetH2: 14,
  targetParagraphs: 90,
  targetLists: 18,
  targetTables: 2,
  targetImages: 4,
  targetFaqs: 6,
  targetClaims: 8,
  targetQuestions: 5,
  targetExamples: 6,
  targetChecklists: 4,
  requiredSections: ['Quick Answer', 'FAQ'],
  freshness: 'high',
  budget: {
    words: 3650,
    paragraphs: 90,
    h2: 14,
    lists: 18,
    tables: 2,
    images: 4,
    claims: 8,
    questions: 5,
    examples: 6,
    warnings: 3,
    checklists: 4,
    comparisons: 1,
    faq: 6,
  },
};

describe('Competitor Benchmark hard gate', () => {
  it('FAILS when plan words are below benchmark', () => {
    const thin: ArticleBlueprint = {
      ...blueprintOk,
      targetWords: 2100,
      budget: { ...blueprintOk.budget, words: 2100 },
    };
    const outline: AdaptiveOutline = {
      h1: 'test',
      narrativeOrder: [],
      sections: Array.from({ length: 14 }, (_, i) => ({
        id: `s${i}`,
        heading: `S${i}`,
        role: `r${i}`,
        importance: 5,
        assignedClaimIds: [],
        assignedQuestionIds: [],
        requiredBlocks: ['example'],
        expectedWords: 150,
        evidenceNeeds: [],
        freshnessNotes: [],
        sectionBudget: sampleBrief().budget,
      })),
    };
    const result = validateAgainstBenchmark({
      blueprint: thin,
      outline,
      benchmark,
    });
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.code === 'below_competitor_benchmark')).toBe(true);
  });

  it('FAILS when H2 count is below benchmark', () => {
    const outline: AdaptiveOutline = {
      h1: 'test',
      narrativeOrder: [],
      sections: Array.from({ length: 5 }, (_, i) => ({
        id: `s${i}`,
        heading: `S${i}`,
        role: `r${i}`,
        importance: 5,
        assignedClaimIds: [],
        assignedQuestionIds: [],
        requiredBlocks: ['example'],
        expectedWords: 200,
        evidenceNeeds: [],
        freshnessNotes: [],
        sectionBudget: sampleBrief().budget,
      })),
    };
    const result = validateAgainstBenchmark({
      blueprint: blueprintOk,
      outline,
      benchmark,
    });
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => /H2/i.test(i.message))).toBe(true);
  });
});

describe('Knowledge Coverage gate', () => {
  it(`FAILS when knowledgeCoveragePct < ${KNOWLEDGE_COVERAGE_MIN_PCT}`, () => {
    const report: KnowledgeCoverageReport = {
      criticalClaims: { total: 10, assigned: 10, pct: 100 },
      questions: { total: 100, assigned: 94, pct: 94 },
      evidenceNeeds: { total: 10, assigned: 10, pct: 100 },
      knowledgeCoveragePct: 94,
    };
    const result = validateKnowledgeCoverageGate(report);
    expect(result.ok).toBe(false);
    expect(result.issues[0]?.code).toBe('knowledge_coverage_below_min');
  });

  it('PASSES at ≥ 95', () => {
    const report: KnowledgeCoverageReport = {
      criticalClaims: { total: 10, assigned: 10, pct: 100 },
      questions: { total: 20, assigned: 19, pct: 95 },
      evidenceNeeds: { total: 8, assigned: 8, pct: 100 },
      knowledgeCoveragePct: 95,
    };
    expect(validateKnowledgeCoverageGate(report).ok).toBe(true);
  });

  it('computeKnowledgeCoverage uses min of slices', () => {
    const kg: TargetKnowledgeGraph = {
      claims: [
        {
          id: 'c1',
          statement: 'SSL required',
          topic: 'tech',
          type: 'fact',
          importance: 'required',
          gainClass: 'core',
          priority: 'critical',
          sources: [],
        },
        {
          id: 'c2',
          statement: 'optional tip',
          topic: 'tips',
          type: 'fact',
          importance: 'optional',
          gainClass: 'opportunity',
          priority: 'low',
          sources: [],
        },
      ],
      questions: [
        {
          id: 'q1',
          question: 'How long?',
          requiredAnswerBrief: '3-6 months',
          importance: 'required',
          priority: 'critical',
          answeredByClaimIds: [],
          status: 'missing',
        },
        {
          id: 'q2',
          question: 'DIY?',
          requiredAnswerBrief: 'yes',
          importance: 'required',
          priority: 'high',
          answeredByClaimIds: [],
          status: 'missing',
        },
      ],
      entities: ['ssl'],
    };
    const outline: AdaptiveOutline = {
      h1: 'seo',
      narrativeOrder: ['s0'],
      sections: [{
        id: 's0',
        heading: 'Start',
        role: 'quick_answer',
        importance: 10,
        assignedClaimIds: ['c1'],
        assignedQuestionIds: ['q1'],
        requiredBlocks: ['example'],
        expectedWords: 200,
        evidenceNeeds: ['example'],
        freshnessNotes: [],
        sectionBudget: sampleBrief().budget,
      }],
    };
    const briefs = [sampleBrief({
      sectionId: 's0',
      claimIds: ['c1'],
      questionIds: ['q1'],
      evidence: [{ kind: 'example', hint: 'x' }],
    })];
    const report = computeKnowledgeCoverage({ kg, outline, briefs });
    // critical 100%, questions 50%, evidence 100% → min 50
    expect(report.criticalClaims.pct).toBe(100);
    expect(report.questions.pct).toBe(50);
    expect(report.knowledgeCoveragePct).toBe(50);
  });
});

describe('Article Execution Plan', () => {
  it('builds plan_hash and sidecar projection', async () => {
    const result = runContentPlanner({
      keyword: 'jak pozycjonować stronę',
      year: 2026,
      allowBrandNiche: false,
      competitors: [
        {
          url: 'https://a.example/seo',
          position: 1,
          wordCount: 3600,
          paragraphs: 90,
          headings: 15,
          lists: 20,
          tables: 2,
          images: 4,
          faq: 6,
          examples: 10,
          claims: [
            'Certyfikat SSL jest wymagany',
            'Google ocenia strony mobile-first',
            'Search Console monitoruje indeksację',
            'Efekty SEO po 3-6 miesiącach',
            'Linkowanie wewnętrzne poprawia indeksowanie',
            'PageSpeed Insights mierzy LCP',
            'robots.txt wpływa na indeksację',
            'Długie frazy mają wyższą konwersję',
          ],
          questions: [
            'Ile trwa pozycjonowanie?',
            'Czy można pozycjonować samemu?',
            'Ile kosztuje SEO?',
            'Jakie narzędzia SEO?',
            'Jak zacząć pozycjonowanie?',
            'Jakie błędy unikać?',
          ],
          entities: ['ssl', 'search console', 'pagespeed'],
        },
        {
          url: 'https://b.example/seo',
          position: 2,
          wordCount: 3400,
          paragraphs: 85,
          headings: 14,
          lists: 18,
          tables: 2,
          images: 3,
          faq: 5,
          examples: 8,
          claims: [
            'Certyfikat SSL jest wymagany',
            'Google ocenia strony mobile-first',
            'Search Console monitoruje indeksację',
            'Efekty SEO po 3-6 miesiącach',
          ],
          questions: [
            'Ile trwa pozycjonowanie?',
            'Czy można pozycjonować samemu?',
          ],
          entities: ['ssl'],
        },
      ],
      produceArticle: false,
    });

    expect(result.canWrite).toBe(true);
    expect(result.bundle.knowledgeCoverage).toBeTruthy();
    expect(result.bundle.knowledgeCoverage!.knowledgeCoveragePct).toBeGreaterThanOrEqual(
      KNOWLEDGE_COVERAGE_MIN_PCT,
    );

    const finalized = await finalizePlannerForWrite(result, {
      quickAnswerOverride:
        'Zacznij od Quick Wins: Search Console, SSL i 5 stron filarowych — pierwsze sygnały w kilka tygodni, nie po roku czekania na cud.',
    });
    expect(finalized.canWrite).toBe(true);
    expect(finalized.bundle.executionPlan).toBeTruthy();
    const plan = finalized.bundle.executionPlan!;
    expect(plan.planHash).toHaveLength(32);
    expect(plan.sections.length).toBeGreaterThanOrEqual(7);
    expect(plan.quickAnswer.length).toBeGreaterThan(40);

    const rebuilt = buildArticleExecutionPlan(finalized.bundle);
    expect(rebuilt?.planHash).toBe(plan.planHash);

    const sidecar = toSidecarExecutionPlan(plan);
    expect(sidecar.plan_hash).toBe(plan.planHash);
    expect(Array.isArray(sidecar.sections)).toBe(true);
    expect((sidecar.sections as unknown[]).length).toBe(plan.sections.length);

    const withoutHash = { ...plan };
    delete (withoutHash as { planHash?: string }).planHash;
    expect(hashExecutionPlanPayload(withoutHash)).toBe(plan.planHash);
  });

  it('Plan Validator fails without Quick Answer', () => {
    const result = runContentPlanner({
      keyword: 'jak pozycjonować stronę',
      year: 2026,
      competitors: [
        {
          url: 'https://a.example/seo',
          wordCount: 3600,
          headings: 14,
          paragraphs: 90,
          lists: 18,
          tables: 2,
          faq: 6,
          examples: 8,
          claims: Array.from({ length: 8 }, (_, i) => `Claim fact number ${i} about SEO`),
          questions: Array.from({ length: 6 }, (_, i) => `Question ${i} about SEO?`),
          entities: ['ssl', 'gsc'],
        },
      ],
    });
    const planVal = validatePlanForWrite({
      blueprint: result.bundle.blueprint,
      outline: result.bundle.outline,
      briefs: result.bundle.briefs,
      kg: result.bundle.targetKg,
      benchmark: result.bundle.benchmark,
      synthesis: result.bundle.competitorSynthesis,
      quickAnswer: null,
      knowledgeCoverage: result.bundle.knowledgeCoverage,
    });
    expect(planVal.ok).toBe(false);
    expect(planVal.issues.some((i) => i.code === 'quick_answer_empty')).toBe(true);
  });

  /**
   * The last-resort branch fires only when a gate reports `ok: false` with no issues to
   * show for it — the one case where the caller has nothing else to go on. "Structural
   * planner gates failed" is exactly the message the per-gate reporting replaced.
   */
  it('names the gate that failed silently instead of reporting "gates failed"', async () => {
    const result = runContentPlanner({
      keyword: 'jak pozycjonować stronę',
      year: 2026,
      competitors: [
        {
          url: 'https://a.example/seo',
          wordCount: 3600,
          headings: 14,
          paragraphs: 90,
          lists: 18,
          tables: 2,
          faq: 6,
          examples: 8,
          claims: Array.from({ length: 8 }, (_, i) => `Claim fact number ${i} about SEO`),
          questions: Array.from({ length: 6 }, (_, i) => `Question ${i} about SEO?`),
          entities: ['ssl'],
        },
      ],
    });

    const finalized = await finalizePlannerForWrite({
      ...result,
      canWrite: false,
      outlineValidation: { ok: false, issues: [] },
    });

    const blocked = finalized.planValidation?.issues.find((i) => i.code === 'structure_blocked');
    expect(blocked).toBeDefined();
    expect(blocked!.message).toMatch(/outline/i);
  });

  /**
   * Plan conformity is ANDed into `canWrite` like the other gates, so its heading
   * mismatches have to travel with it — reported as a silent gate they told the caller
   * nothing about which heading the writer invented.
   */
  it('forwards the plan-conformity heading mismatches, not just the gate name', async () => {
    const result = runContentPlanner({
      keyword: 'jak pozycjonować stronę',
      year: 2026,
      competitors: [
        {
          url: 'https://a.example/seo',
          wordCount: 3600,
          headings: 14,
          paragraphs: 90,
          lists: 18,
          tables: 2,
          faq: 6,
          examples: 8,
          claims: Array.from({ length: 8 }, (_, i) => `Claim fact number ${i} about SEO`),
          questions: Array.from({ length: 6 }, (_, i) => `Question ${i} about SEO?`),
          entities: ['ssl'],
        },
      ],
    });

    const planConformity = validatePlanConformity(
      '<h2>Nagłówek, którego nie było w planie</h2>',
      ['Czym jest pozycjonowanie'],
    );
    expect(planConformity.ok).toBe(false);

    const finalized = await finalizePlannerForWrite({
      ...result,
      canWrite: false,
      postWrite: {
        flow: { ok: true, issues: [] },
        claims: { ok: true, issues: [] },
        questions: { ok: true, issues: [] },
        seo: { ok: true, issues: [] },
        planConformity,
        coverageBefore: 1,
        coverageAfter: 1,
        rewriteSteps: 0,
        kceApplied: 0,
      },
    });

    const codes = finalized.planValidation?.issues.map((i) => i.code) ?? [];
    expect(codes).toContain('h2_not_in_plan');
    expect(finalized.planValidation?.issues.find((i) => i.code === 'h2_not_in_plan')?.message)
      .toMatch(/nie było w planie/i);
  });

  it('finalizePlannerForWrite returns canWrite false when Quick Answer LLM fails', async () => {
    const result = runContentPlanner({
      keyword: 'jak pozycjonować stronę',
      year: 2026,
      competitors: [
        {
          url: 'https://a.example/seo',
          wordCount: 3600,
          headings: 14,
          paragraphs: 90,
          lists: 18,
          tables: 2,
          faq: 6,
          examples: 8,
          claims: Array.from({ length: 8 }, (_, i) => `Claim fact number ${i} about SEO`),
          questions: Array.from({ length: 6 }, (_, i) => `Question ${i} about SEO?`),
          entities: ['ssl'],
        },
      ],
    });
    const finalized = await finalizePlannerForWrite(result, {
      llmEdit: async () => ({ html: 'SEO to proces optymalizacji.', tokens: 10 }),
    });
    expect(finalized.canWrite).toBe(false);
    expect(finalized.planValidation?.issues.some((i) => /quick_answer/i.test(i.code))).toBe(true);
  });
});
