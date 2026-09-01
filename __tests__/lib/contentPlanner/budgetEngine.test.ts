import { buildArticleBudget } from '../../../lib/contentPlanner/budgetEngine';
import { MAX_CLAIMS_PER_SECTION } from '../../../lib/knowledgeEngine/constants';
import type { CompetitorBenchmark, TargetClaim, TargetKnowledgeGraph } from '../../../lib/contentPlanner/types';

const benchmark = (targetH2: number): CompetitorBenchmark => ({
  competitorCount: 5,
  averageWords: 1200,
  medianWords: 1200,
  targetWords: 1200,
  averageH2: targetH2,
  targetH2,
  averageParagraphs: 40,
  averageLists: 5,
  averageTables: 1,
  averageImages: 2,
  averageFaq: 4,
  averageExamples: 3,
  averageClaims: 10,
  averageQuestions: 5,
  commonHeadings: [],
  commonClaims: [],
  commonQuestions: [],
} as unknown as CompetitorBenchmark);

const kgWith = (n: number): TargetKnowledgeGraph => ({
  claims: Array.from({ length: n }, (_, i) => ({
    id: `c${i}`,
    statement: `Fakt ${i}.`,
    topic: 't',
    type: 'fact',
    importance: 'required',
    gainClass: 'opportunity',
    priority: 'high',
    sources: [],
  } as TargetClaim)),
  questions: [],
  entities: [],
  mustCoverClaimIds: [],
  mustAnswerQuestionIds: [],
});

describe('buildArticleBudget claim target', () => {
  /**
   * Every gain class maps to `required` (importanceFromGain), so requiredClaims equals the
   * full graph — 65 on a real SERP. targetClaims must still fit the outline (h2 sections ×
   * MAX_CLAIMS_PER_SECTION), or the 90% assignment floor is unreachable and every
   * claim-rich keyword fails claims_underassigned. This was the article-15 outline failure.
   */
  it('never targets more claims than the outline can hold', () => {
    const h2 = 7;
    const budget = buildArticleBudget(benchmark(h2), kgWith(65));

    expect(budget.claims).toBeLessThanOrEqual(h2 * MAX_CLAIMS_PER_SECTION);
    // A 90% assignment floor over the target must be reachable inside that capacity.
    expect(Math.ceil(budget.claims * 0.9)).toBeLessThanOrEqual(h2 * MAX_CLAIMS_PER_SECTION);
  });

  it('still uses the full graph when it fits the outline', () => {
    const budget = buildArticleBudget(benchmark(7), kgWith(12));
    expect(budget.claims).toBe(12);
  });
});
