/**
 * Regression coverage for CIE / planner review fixes (2026-08-04).
 */
import {
  buildAdaptiveOutline,
  buildArticleBudget,
  buildIntentBlueprint,
  buildTargetKnowledgeGraph,
  hashExecutionPlanPayload,
  optimizeNarrative,
  runKnowledgeCompletion,
  stubWriteSection,
  synthesizeCompetitors,
  validatePlanConformity,
  validatePlannerPlan,
  validateRequiredAssignments,
} from '../../../lib/contentPlanner';
import { competitorsFromScoreData } from '../../../lib/contentPlanner/fromArticleInputs';
import { benchmarkDocsFromCompetitors } from '../../../lib/benchmarkIntelligence/fromCompetitors';
import {
  extractRawKnowledge,
  sentencesToCanonicalizeInputs,
  voteEntities,
  patchExecutionPlanFromCoverage,
  buildKnowledgeGraph,
  canonicalizeClaims,
  getEmbeddingProvider,
} from '../../../lib/knowledgeEngine';
import type {
  AdaptiveOutline,
  ArticleBlueprint,
  ArticleExecutionPlan,
  CompetitorBenchmark,
  IntentBlueprint,
  ReaderModel,
  SectionBrief,
  TargetKnowledgeGraph,
} from '../../../lib/contentPlanner/types';
import type { CanonicalClaim } from '../../../lib/knowledgeEngine/types';

const emptyBudget: CompetitorBenchmark = {
  averageWords: 3000,
  bestWords: 3000,
  averageH2: 10,
  averageParagraphs: 60,
  averageLists: 8,
  averageTables: 1,
  averageImages: 2,
  averageFaq: 5,
  averageClaims: 8,
  averageExamples: 4,
  averageQuestions: 6,
  targetWords: 3000,
  targetH2: 10,
};

const intent: IntentBlueprint = {
  keyword: 'seo',
  primaryIntent: 'informational',
  articleType: 'guide',
  first60sQuestions: [],
  narrativePreference: 'problem_solution',
  allowBrandNiche: false,
  yearHint: 2026,
};

const reader: ReaderModel = {
  keyword: 'seo',
  readerPersona: 'beginner',
  goal: 'rank',
  timeBudgetMinutes: 20,
  knowledgeLevel: 'low',
  desiredOutcome: 'traffic',
  tone: 'practical',
  articleType: 'guide',
  fears: [],
  expectedCta: 'start',
};

function emptyKg(partial?: Partial<TargetKnowledgeGraph>): TargetKnowledgeGraph {
  return {
    claims: [],
    questions: [],
    entities: [],
    ...partial,
  };
}

describe('outlineBuilder — summary-only question leftover', () => {
  it('terminates and assigns questions when all seeds are summary', () => {
    const blueprint: ArticleBlueprint = {
      targetWords: 2000,
      targetH2: 2,
      targetParagraphs: 40,
      targetLists: 4,
      targetTables: 1,
      targetImages: 2,
      targetFaqs: 3,
      targetClaims: 2,
      targetQuestions: 3,
      targetExamples: 1,
      targetChecklists: 1,
      requiredSections: [],
      freshness: 'medium',
      budget: {
        words: 2000, paragraphs: 40, h2: 2, lists: 4, tables: 1, images: 2,
        claims: 2, questions: 3, examples: 1, warnings: 1, checklists: 1, comparisons: 0, faq: 3,
      },
    };
    const kg = emptyKg({
      questions: [
        { id: 'q1', question: 'A?', requiredAnswerBrief: 'a', importance: 'required', priority: 'high', answeredByClaimIds: [], status: 'missing' },
        { id: 'q2', question: 'B?', requiredAnswerBrief: 'b', importance: 'required', priority: 'high', answeredByClaimIds: [], status: 'missing' },
      ],
    });

    const outline = buildAdaptiveOutline({
      blueprint,
      kg,
      reader,
      intent,
      narrativeSeeds: [
        { role: 'summary', heading: 'Podsumowanie 1', importance: 2 },
        { role: 'summary_end', heading: 'Podsumowanie 2', importance: 1 },
      ],
    });

    const assigned = outline.sections.flatMap((s) => s.assignedQuestionIds);
    expect(assigned).toEqual(expect.arrayContaining(['q1', 'q2']));
    expect(assigned).toHaveLength(2);
  });
});

describe('intentBlueprint — PL stems + EN cues', () => {
  it('classifies Polish inflected commercial/comparison keywords', () => {
    expect(buildIntentBlueprint({ keyword: 'cennika SEO agencji' }).primaryIntent).toBe('commercial');
    expect(buildIntentBlueprint({ keyword: 'porównanie narzędzi SEO' }).articleType).toBe('comparison');
  });

  it('emits English first-60s cues for English keywords', () => {
    const en = buildIntentBlueprint({ keyword: 'how to improve SEO ranking' });
    expect(en.first60sQuestions[0]).toMatch(/^How do I start/i);
    expect(en.first60sQuestions.join(' ')).not.toMatch(/Jak zacząć|Ile to trwa/);
  });
});

describe('budgetEngine — empty KG', () => {
  it('returns zero claim/question targets for empty Target KG', () => {
    const budget = buildArticleBudget(emptyBudget, emptyKg());
    expect(budget.claims).toBe(0);
    expect(budget.questions).toBe(0);
  });
});

describe('narrativeOptimizer — required sections survive truncation', () => {
  it('keeps every required section when count exceeds targetH2', () => {
    const required = ['Quick Answer', 'A', 'B', 'C', 'D', 'E', 'F'];
    const seeds = optimizeNarrative({
      topicBlocks: [],
      intent,
      targetH2: 5,
      requiredSections: required,
    });
    expect(seeds.length).toBeGreaterThanOrEqual(required.length);
    for (const name of required) {
      expect(seeds.some((s) => s.heading === name)).toBe(true);
    }
  });
});

describe('plannerValidator — enforce targets.h2', () => {
  it('fails when sections below benchmark target above five', () => {
    const outline: AdaptiveOutline = {
      h1: 'x',
      narrativeOrder: ['1', '2', '3', '4', '5'],
      sections: Array.from({ length: 5 }, (_, i) => ({
        id: String(i),
        heading: `H${i}`,
        role: 'action',
        importance: 5,
        assignedClaimIds: [],
        assignedQuestionIds: [],
        requiredBlocks: [],
        expectedWords: 200,
        evidenceNeeds: ['source'],
        freshnessNotes: [],
        sectionBudget: {
          words: 200, claims: 0, entities: 0, questions: 0, examples: 0,
          lists: 0, tables: 0, images: 0, faq: 0, citations: 0,
        },
      })),
    };
    const result = validatePlannerPlan({
      outline,
      briefs: [],
      kg: emptyKg(),
      targets: {
        words: 3000,
        h2: 12,
        faq: 5,
        tables: 1,
        lists: 8,
        images: 2,
        examples: 3,
        citations: 5,
        wordsSoftCeiling: 4000,
        h2SoftCeiling: 16,
      },
    });
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.code === 'h2_below_benchmark')).toBe(true);
  });
});

describe('postWriteValidators — exact H2 conformity', () => {
  it('rejects substring-only heading matches', () => {
    const result = validatePlanConformity(
      '<h1>x</h1><h2>Quick Answer for beginners</h2>',
      ['Quick Answer'],
    );
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.code === 'h2_not_in_plan')).toBe(true);
  });

  it('accepts exact planned headings', () => {
    const result = validatePlanConformity(
      '<h1>x</h1><h2>Quick Answer</h2><h2>FAQ</h2>',
      ['Quick Answer', 'FAQ'],
    );
    expect(result.ok).toBe(true);
  });
});

describe('planValidators — critical evidence needs', () => {
  it('rejects critical sections with empty evidenceNeeds', () => {
    const outline: AdaptiveOutline = {
      h1: 'x',
      narrativeOrder: ['s1'],
      sections: [{
        id: 's1',
        heading: 'Critical',
        role: 'action',
        importance: 9,
        assignedClaimIds: [],
        assignedQuestionIds: [],
        requiredBlocks: [],
        expectedWords: 200,
        evidenceNeeds: [],
        freshnessNotes: [],
        sectionBudget: {
          words: 200, claims: 0, entities: 0, questions: 0, examples: 0,
          lists: 0, tables: 0, images: 0, faq: 0, citations: 0,
        },
      }],
    };
    const result = validateRequiredAssignments({ kg: emptyKg(), outline });
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.code === 'evidence_need_missing')).toBe(true);
  });
});

describe('knowledgeIntelligence — IDs, gain, sources', () => {
  it('keeps unique claim ids and competitor-only gain; AI sources only on AI-backed claims', () => {
    const longA = `${'ssl is required for https security everywhere on the web today and '.repeat(3)}alpha`;
    const longB = `${'ssl is required for https security everywhere on the web today and '.repeat(3)}beta`;
    const kg = buildTargetKnowledgeGraph({
      profiles: [
        {
          url: 'https://a.example',
          position: 1,
          authority: 0.8,
          wordCount: 3000,
          paragraphs: 50,
          headings: 10,
          images: 2,
          tables: 1,
          lists: 5,
          faq: 3,
          examples: 2,
          caseStudies: 0,
          claims: ['Competitor only claim about SSL certificates'],
          questions: [],
          entities: [],
          sources: [],
          statistics: [],
          openingPattern: 'unknown',
          closingPattern: 'unknown',
        },
      ],
      ai: {
        claims: [
          longA,
          longB,
          'AI only unique claim about Core Web Vitals thresholds',
        ],
        sources: [{ url: 'https://ai.example/cite', label: 'AI', confidence: 0.9 }],
      },
    });

    const ids = kg.claims.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);

    const competitorClaim = kg.claims.find((c) => /Competitor only/i.test(c.statement));
    expect(competitorClaim?.sources).toEqual([]);
    expect(competitorClaim?.citationHint).toContain('a.example');

    const aiOnly = kg.claims.find((c) => /AI only unique/i.test(c.statement));
    expect(aiOnly?.gainClass).toBe('opportunity'); // 0 competitor hits
    expect(aiOnly?.sources.some((s) => s.url.includes('ai.example'))).toBe(true);
  });
});

describe('competitorBenchmark — per-profile frequency', () => {
  it('does not treat repeated claims on one page as cross-competitor common', () => {
    const synth = synthesizeCompetitors([
      {
        url: 'https://a.example',
        position: 1,
        authority: 0.5,
        wordCount: 2000,
        paragraphs: 40,
        headings: 8,
        images: 1,
        tables: 0,
        lists: 2,
        faq: 1,
        examples: 1,
        caseStudies: 0,
        claims: ['Unique claim repeated', 'Unique claim repeated', 'Unique claim repeated'],
        questions: [],
        entities: ['SSL', 'SSL'],
        sources: [],
        statistics: [],
        openingPattern: 'unknown',
        closingPattern: 'unknown',
      },
      {
        url: 'https://b.example',
        position: 2,
        authority: 0.5,
        wordCount: 2000,
        paragraphs: 40,
        headings: 8,
        images: 1,
        tables: 0,
        lists: 2,
        faq: 1,
        examples: 1,
        caseStudies: 0,
        claims: ['Other claim'],
        questions: [],
        entities: ['CWV'],
        sources: [],
        statistics: [],
        openingPattern: 'unknown',
        closingPattern: 'unknown',
      },
    ]);
    expect(synth.commonClaims).not.toContain('unique claim repeated');
    expect(synth.missingTopics).toContain('unique claim repeated');
    expect(synth.commonHeadings).toEqual([]);
  });
});

describe('fromArticleInputs — first non-empty competitor list', () => {
  it('falls through empty primary array to SERP competitors', () => {
    const rows = competitorsFromScoreData({
      competitors: [],
      serp_competitors: [{ url: 'https://serp.example', wordCount: 1000, claims: ['x'] }],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].url).toBe('https://serp.example');
  });

  it('skips malformed rows', () => {
    const rows = competitorsFromScoreData({
      competitors: [null, { notUrl: true }, { url: 'https://ok.example' }],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].url).toBe('https://ok.example');
  });
});

describe('knowledgeCompletion — reorder Quick before theory', () => {
  it('moves Quick Start H2 before theory on rewrite_intro', () => {
    const outline: AdaptiveOutline = {
      h1: 'SEO',
      narrativeOrder: ['t', 'q'],
      sections: [
        {
          id: 't',
          heading: 'Podstawy SEO',
          role: 'foundation',
          importance: 8,
          assignedClaimIds: [],
          assignedQuestionIds: [],
          requiredBlocks: [],
          expectedWords: 200,
          evidenceNeeds: [],
          freshnessNotes: [],
          sectionBudget: {
            words: 200, claims: 0, entities: 0, questions: 0, examples: 0,
            lists: 0, tables: 0, images: 0, faq: 0, citations: 0,
          },
        },
        {
          id: 'q',
          heading: 'Quick Start',
          role: 'quick_start',
          importance: 10,
          assignedClaimIds: [],
          assignedQuestionIds: [],
          requiredBlocks: [],
          expectedWords: 200,
          evidenceNeeds: [],
          freshnessNotes: [],
          sectionBudget: {
            words: 200, claims: 0, entities: 0, questions: 0, examples: 0,
            lists: 0, tables: 0, images: 0, faq: 0, citations: 0,
          },
        },
      ],
    };
    const html = '<h1>SEO</h1><h2>Podstawy SEO</h2><p>theory</p><h2>Quick Start</h2><p>action</p>';
    const { html: next } = runKnowledgeCompletion({
      html,
      plan: { steps: [{ sectionId: 'q', action: 'rewrite_intro', detail: 'reorder' }] },
      outline,
      kg: emptyKg(),
      briefs: [],
    });
    const h2s = [...next.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)].map((m) => m[1]);
    expect(h2s[0]).toMatch(/Quick Start/i);
    expect(h2s[1]).toMatch(/Podstawy/i);
  });
});

describe('sectionWriter — escapes claim HTML', () => {
  it('escapes active markup in claim statements', () => {
    const kg = emptyKg({
      claims: [{
        id: 'c1',
        statement: '</li><script>alert(1)</script>',
        topic: 'x',
        type: 'fact',
        importance: 'required',
        gainClass: 'expected',
        priority: 'high',
        sources: [],
      }],
    });
    const brief: SectionBrief = {
      sectionId: 's1',
      heading: 'Safe',
      objective: 'obj',
      claimIds: ['c1'],
      questionIds: [],
      blocks: ['example'],
      evidence: [],
      budget: {
        words: 100, claims: 1, entities: 0, questions: 0, examples: 1,
        lists: 0, tables: 0, images: 0, faq: 0, citations: 0,
      },
      freshnessNotes: [],
      mustAnswer: [],
      sectionPriority: 'high',
      writerHints: {
        previousSection: null, nextSection: null, transition: '', tone: 'p', avoidRepeating: [],
      },
    };
    const html = stubWriteSection({ brief, kg });
    expect(html).not.toMatch(/<script>/i);
    expect(html).toMatch(/&lt;script&gt;/i);
  });
});

describe('extract + canonicalize extras', () => {
  it('preserves extra source kind and leaves serpPosition unset for extras', () => {
    const raw = extractRawKnowledge({
      docs: [],
      extraTexts: [{ text: 'AI overview sentence that is long enough to extract as claim text.', url: 'synthetic://ai', kind: 'ai_overview' }],
    });
    expect(raw.sentences[0].kind).toBe('ai_overview');
    expect(raw.sentences[0].serpPosition).toBe(0);
    const inputs = sentencesToCanonicalizeInputs(raw.sentences);
    expect(inputs[0].kind).toBe('ai_overview');
    expect(inputs[0].serpPosition).toBeUndefined();
  });

  it('does not promote lookalike hosts to official', async () => {
    const provider = getEmbeddingProvider();
    const [fake] = await canonicalizeClaims(
      [{
        text: 'Mobile-first indexing is the default crawling mode for Google Search today.',
        url: 'https://notdevelopers.google.com/doc',
        kind: 'competitor',
      }],
      { provider },
    );
    const [real] = await canonicalizeClaims(
      [{
        text: 'HTTPS and valid SSL certificates are required for secure sites in Chrome.',
        url: 'https://developers.google.com/search/docs',
        kind: 'competitor',
      }],
      { provider },
    );
    expect(fake.evidence[0].kind).toBe('competitor');
    expect(real.evidence[0].kind).toBe('official');
  });
});

describe('voteEntities — unique document hits', () => {
  it('counts presence across competitor docs, not deduped list length', () => {
    const docs = [
      { url: 'https://a.example', title: 'A', score: 90, authority: 0.9, headings: ['SSL'], entities: ['ssl'], claimIds: [], topicBlockIds: [], serpPosition: 1 },
      { url: 'https://b.example', title: 'B', score: 80, authority: 0.8, headings: ['SSL Certificate'], entities: [], claimIds: [], topicBlockIds: [], serpPosition: 2 },
      { url: 'https://c.example', title: 'C', score: 70, authority: 0.7, headings: ['Other'], entities: [], claimIds: [], topicBlockIds: [], serpPosition: 3 },
    ];
    const votes = voteEntities(['ssl'], docs);
    expect(votes[0].docsHit).toBe(2);
    expect(votes[0].consensus).toBeCloseTo(2 / 3);
  });
});

describe('aoPlanPatch — no revision for already-assigned claims', () => {
  it('skips patchedClaimIds and keeps hash stable for already-present claims', () => {
    const claim: CanonicalClaim = {
      id: 'CLAIM_x',
      statement: 'SSL is required for secure browsing on modern websites worldwide.',
      cluster: 'Tech',
      importance: 'high',
      importanceScore: 70,
      consensus: 0.5,
      evidence: [{
        kind: 'competitor',
        url: 'https://a.example',
        domain: 'a.example',
        favicon: '',
        title: 'A',
        weight: 1,
        roles: ['serp'],
      }],
      usedByCompetitors: 1,
      competitorsTotal: 2,
      usedInSections: [],
      generatedFrom: ['serp'],
      sourceDiversity: {
        official: false, competitors: true, aiOverview: false, paa: false, score: 0.25,
      },
      consensusExplanation: { percent: 50, because: [] },
    };
    const graph = buildKnowledgeGraph({
      claims: [claim],
      entities: [],
      topicBlocks: [],
      gaps: [],
      competitors: [],
      stageTimingsMs: {
        extract: 0, normalize: 0, canonicalize: 0, vote: 0, cluster: 0, build: 0, verify: 0,
      },
      verifier: { ok: true, issues: [] },
    });
    const plan: ArticleExecutionPlan = {
      schemaVersion: 2,
      plannerVersion: '2.0.0',
      planHash: 'old',
      keyword: 'seo',
      title: 'SEO',
      narrative: 'step_by_step',
      quickAnswer: 'Start.',
      reader: { persona: 'p', goal: 'g', tone: 't', timeBudgetMinutes: 10 },
      articleBudget: {
        words: 2000, paragraphs: 40, h2: 8, lists: 8, tables: 1, images: 2,
        claims: 5, questions: 3, examples: 2, warnings: 1, checklists: 2, comparisons: 1, faq: 3,
      },
      benchmark: emptyBudget,
      knowledgeCoverage: {
        criticalClaims: { total: 1, assigned: 1, pct: 100 },
        questions: { total: 0, assigned: 0, pct: 100 },
        evidenceNeeds: { total: 1, assigned: 1, pct: 100 },
        knowledgeCoveragePct: 100,
      },
      requiredCoverage: { claims: 1, questions: 0, entities: 0, evidence: 1, examples: 0 },
      sections: [{
        id: 's1',
        heading: 'Tech',
        objective: 'o',
        priority: 'high',
        expectedWords: 300,
        claims: [{ id: 'CLAIM_x', statement: claim.statement, sources: [] }],
        entities: [],
        questions: [],
        mustAnswer: [],
        evidence: [],
        blocks: ['checklist'],
        budget: {
          words: 300, claims: 1, entities: 0, questions: 0, examples: 0,
          lists: 1, tables: 0, images: 0, faq: 0, citations: 0,
        },
        writerHints: {
          previousSection: null, nextSection: null, transition: '', tone: 'p', avoidRepeating: [],
        },
      }],
      builtAt: '2026-01-01T00:00:00.000Z',
    };

    const { patchedClaimIds, newPlan } = patchExecutionPlanFromCoverage({
      plan,
      report: {
        items: [{
          claimId: 'CLAIM_x',
          coverage: 'missing',
          coverageScore: 0.1,
          coverageGaps: [claim.statement],
        }],
      },
      graph,
    });
    expect(patchedClaimIds).toEqual([]);
    const { planHash: _ph, ...withoutHash } = newPlan;
    void _ph;
    expect(newPlan.planHash).toBe(hashExecutionPlanPayload(withoutHash));
  });
});

describe('benchmark fromCompetitors — use examples field', () => {
  it('uses supplied examples count instead of claim-derived heuristic', () => {
    const docs = benchmarkDocsFromCompetitors([
      { url: 'https://a.example', claims: ['a', 'b', 'c', 'd', 'e'], examples: 9 },
    ]);
    expect(docs[0].examples).toBe(9);
  });
});
