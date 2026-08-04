import {
  buildKnowledgeGraph,
  computeClaimCoverage,
  coverageStatusForClaim,
  getEmbeddingProvider,
  patchExecutionPlanFromCoverage,
  plansDiffer,
} from '../../../lib/knowledgeEngine';
import type { ArticleExecutionPlan } from '../../../lib/contentPlanner/types';
import type { CanonicalClaim } from '../../../lib/knowledgeEngine';

function sampleClaim(overrides: Partial<CanonicalClaim> = {}): CanonicalClaim {
  return {
    id: 'CLAIM_ssl',
    statement: 'Certyfikat SSL jest wymagany dla bezpiecznego połączenia HTTPS.',
    cluster: 'Technical SEO',
    importance: 'high',
    importanceScore: 80,
    consensus: 0.9,
    evidence: [{
      kind: 'official',
      url: 'https://developers.google.com/search',
      domain: 'developers.google.com',
      favicon: '',
      title: 'Google',
      weight: 1,
      roles: ['official'],
    }],
    usedByCompetitors: 1,
    competitorsTotal: 1,
    usedInSections: [],
    generatedFrom: ['official'],
    sourceDiversity: { official: true, competitors: false, aiOverview: false, paa: false, score: 0.25 },
    consensusExplanation: { percent: 90, because: ['Official'] },
    ...overrides,
  };
}

describe('claim coverage overlay', () => {
  it('marks paraphrase covered and unrelated missing', async () => {
    const provider = getEmbeddingProvider();
    const claim = sampleClaim();
    const covered = await coverageStatusForClaim(
      claim,
      'Certyfikat SSL jest wymagany dla bezpiecznego połączenia HTTPS na stronie.',
      provider,
    );
    const missing = await coverageStatusForClaim(
      claim,
      'Warszawa jest stolicą Polski i dużym miastem wojewódzkim nad Wisłą.',
      provider,
    );
    expect(covered).toBe('covered');
    expect(missing).toBe('missing');
  });

  it('finds claim covered in later article windows (not only first 4k bag)', async () => {
    const claim = sampleClaim();
    const padding = 'Lorem ipsum dolor sit amet. '.repeat(200);
    const html = `<p>${padding}</p><p>Certyfikat SSL jest wymagany dla bezpiecznego połączenia HTTPS na stronie.</p>`;
    const report = await computeClaimCoverage({
      graph: buildKnowledgeGraph({
        claims: [claim],
        entities: [],
        topicBlocks: [],
        gaps: [],
        competitors: [],
        stageTimingsMs: {
          extract: 1, normalize: 1, canonicalize: 1, vote: 1, cluster: 1, build: 1, verify: 1,
        },
        verifier: { ok: true, issues: [] },
      }),
      articleHtml: html,
      sectionCount: 2,
    });
    expect(report.items[0].coverage).toBe('covered');
  });

  it('does not mutate frozen graph when computing report', async () => {
    const claim = sampleClaim();
    const graph = buildKnowledgeGraph({
      claims: [claim],
      entities: [],
      topicBlocks: [],
      gaps: [],
      competitors: [],
      stageTimingsMs: {
        extract: 1, normalize: 1, canonicalize: 1, vote: 1, cluster: 1, build: 1, verify: 1,
      },
      verifier: { ok: true, issues: [] },
    });
    const report = await computeClaimCoverage({
      graph,
      articleHtml: '<p>Certyfikat SSL jest wymagany dla bezpiecznego połączenia HTTPS.</p>',
      sectionCount: 1,
    });
    expect(Object.isFrozen(graph)).toBe(true);
    expect(Object.isFrozen(graph.claims)).toBe(true);
    expect(report.items[0].coverage).toBe('covered');
    expect(report.writerMetrics?.coveragePct).toBe(100);
  });
});

describe('aoPlanPatch', () => {
  it('returns new plan and leaves graph frozen', () => {
    const claim = sampleClaim({ id: 'CLAIM_miss', statement: 'Linkowanie wewnętrzne poprawia indeksowanie podstron witryny.' });
    const graph = buildKnowledgeGraph({
      claims: [claim],
      entities: [],
      topicBlocks: [],
      gaps: [],
      competitors: [],
      stageTimingsMs: {
        extract: 1, normalize: 1, canonicalize: 1, vote: 1, cluster: 1, build: 1, verify: 1,
      },
      verifier: { ok: true, issues: [] },
    });
    const plan: ArticleExecutionPlan = {
      schemaVersion: 2,
      plannerVersion: '2.0.0',
      planHash: 'abc',
      keyword: 'seo',
      title: 'SEO',
      narrative: 'step_by_step',
      quickAnswer: 'Start with technical SEO.',
      reader: { persona: 'p', goal: 'g', tone: 't', timeBudgetMinutes: 10 },
      articleBudget: {
        words: 2000, paragraphs: 40, h2: 8, lists: 8, tables: 1, images: 2,
        claims: 5, questions: 3, examples: 2, warnings: 1, checklists: 2, comparisons: 1, faq: 3,
      },
      benchmark: {
        averageWords: 2000, bestWords: 2200, averageH2: 8, averageParagraphs: 40,
        averageLists: 8, averageTables: 1, averageImages: 2, averageFaq: 3,
        averageClaims: 5, averageExamples: 2, averageQuestions: 3,
        targetWords: 2000, targetH2: 8,
      },
      knowledgeCoverage: {
        criticalClaims: { total: 1, assigned: 1, pct: 100 },
        questions: { total: 0, assigned: 0, pct: 100 },
        evidenceNeeds: { total: 1, assigned: 1, pct: 100 },
        knowledgeCoveragePct: 100,
      },
      requiredCoverage: { claims: 1, questions: 0, entities: 1, evidence: 1, examples: 1 },
      sections: [{
        id: 's1',
        heading: 'Technical SEO',
        objective: 'Cover technical basics',
        priority: 'high',
        expectedWords: 300,
        claims: [],
        entities: [],
        questions: [],
        mustAnswer: [],
        evidence: [],
        blocks: ['checklist'],
        budget: {
          words: 300, claims: 0, entities: 1, questions: 0, examples: 0,
          lists: 1, tables: 0, images: 0, faq: 0, citations: 0,
        },
        writerHints: {
          previousSection: null, nextSection: null, transition: '', tone: 'p', avoidRepeating: [],
        },
      }],
      builtAt: new Date().toISOString(),
    };

    const { previousPlanHash, newPlan, patchedClaimIds } = patchExecutionPlanFromCoverage({
      plan,
      report: {
        items: [{
          claimId: 'CLAIM_miss',
          coverage: 'missing',
          coverageScore: 0.1,
          coverageGaps: [claim.statement],
        }],
      },
      graph,
    });

    expect(previousPlanHash).toBe('abc');
    expect(patchedClaimIds).toContain('CLAIM_miss');
    expect(newPlan.planHash).not.toBe(previousPlanHash);
    expect(plansDiffer(plan, newPlan)).toBe(true);
    expect(newPlan.sections[0].claims.some((c) => c.id === 'CLAIM_miss')).toBe(true);
    expect(Object.isFrozen(graph)).toBe(true);
    expect(Object.isFrozen(graph.claims)).toBe(true);
  });
});

describe('applyKnowledgeCoverageOverlay', () => {
  it('persists report and patches plan for missing claims', async () => {
    const { applyKnowledgeCoverageOverlay } = await import('../../../lib/knowledgeEngine');
    const claim = sampleClaim({
      id: 'CLAIM_miss',
      statement: 'Linkowanie wewnętrzne poprawia indeksowanie podstron witryny.',
    });
    const graph = buildKnowledgeGraph({
      claims: [claim],
      entities: [],
      topicBlocks: [],
      gaps: [],
      competitors: [],
      stageTimingsMs: {
        extract: 1, normalize: 1, canonicalize: 1, vote: 1, cluster: 1, build: 1, verify: 1,
      },
      verifier: { ok: true, issues: [] },
    });
    const plan: ArticleExecutionPlan = {
      schemaVersion: 2,
      plannerVersion: '2.0.0',
      planHash: 'abc',
      keyword: 'seo',
      title: 'SEO',
      narrative: 'step_by_step',
      quickAnswer: 'Start with technical SEO.',
      reader: { persona: 'p', goal: 'g', tone: 't', timeBudgetMinutes: 10 },
      articleBudget: {
        words: 2000, paragraphs: 40, h2: 8, lists: 8, tables: 1, images: 2,
        claims: 5, questions: 3, examples: 2, warnings: 1, checklists: 2, comparisons: 1, faq: 3,
      },
      benchmark: {
        averageWords: 2000, bestWords: 2200, averageH2: 8, averageParagraphs: 40,
        averageLists: 8, averageTables: 1, averageImages: 2, averageFaq: 3,
        averageClaims: 5, averageExamples: 2, averageQuestions: 3,
        targetWords: 2000, targetH2: 8,
      },
      knowledgeCoverage: {
        criticalClaims: { total: 1, assigned: 1, pct: 100 },
        questions: { total: 0, assigned: 0, pct: 100 },
        evidenceNeeds: { total: 1, assigned: 1, pct: 100 },
        knowledgeCoveragePct: 100,
      },
      requiredCoverage: { claims: 1, questions: 0, entities: 1, evidence: 1, examples: 1 },
      sections: [{
        id: 's1',
        heading: 'Technical SEO',
        objective: 'Cover technical basics',
        priority: 'high',
        expectedWords: 300,
        claims: [],
        entities: [],
        questions: [],
        mustAnswer: [],
        evidence: [],
        blocks: ['checklist'],
        budget: {
          words: 300, claims: 0, entities: 1, questions: 0, examples: 0,
          lists: 1, tables: 0, images: 0, faq: 0, citations: 0,
        },
        writerHints: {
          previousSection: null, nextSection: null, transition: '', tone: 'p', avoidRepeating: [],
        },
      }],
      builtAt: new Date().toISOString(),
    };

    const { scoreData, report, patchedPlan } = await applyKnowledgeCoverageOverlay(
      {
        knowledge_graph: graph,
        content_planner_v2: { bundle: { executionPlan: plan } },
      },
      '<p>Warszawa jest stolicą Polski i dużym miastem wojewódzkim nad Wisłą.</p>',
    );

    expect(report?.items[0].coverage).toBe('missing');
    expect(scoreData.knowledge_coverage_report).toBeTruthy();
    expect(patchedPlan).toBeTruthy();
    expect(patchedPlan!.planHash).not.toBe('abc');
    expect(patchedPlan!.sections[0].claims.some((c) => c.id === 'CLAIM_miss')).toBe(true);
    expect(Object.isFrozen(graph)).toBe(true);
  });
});
