import type { DistributionStats } from '../../../lib/benchmarkIntelligence/types';
import type { CanonicalClaim } from '../../../lib/knowledgeEngine';
import {
  KNOWLEDGE_SCHEMA_VERSION,
  PLANNER_CLAIMS_FLOOR,
} from '../../../lib/knowledgeEngine';

describe('CIE types smoke', () => {
  it('DistributionStats has percentiles', () => {
    const d: DistributionStats = {
      median: 3600,
      p25: 3100,
      p75: 3900,
      min: 2100,
      max: 4800,
      mean: 3620,
      n: 10,
    };
    expect(d.median).toBe(3600);
  });

  it('claim has importanceScore + sourceDiversity; no dependsOn', () => {
    const c: CanonicalClaim = {
      id: 'CLAIM_1',
      statement: 'Google uses mobile-first indexing.',
      cluster: 'Technical SEO',
      importance: 'critical',
      importanceScore: 92,
      consensus: 0.94,
      evidence: [],
      usedByCompetitors: 9,
      competitorsTotal: 10,
      usedInSections: [],
      generatedFrom: ['serp', 'official'],
      sourceDiversity: {
        official: true,
        competitors: true,
        aiOverview: true,
        paa: false,
        score: 0.75,
      },
      consensusExplanation: { percent: 94, because: ['TOP1', 'TOP2', 'Official'] },
    };
    expect(c.importanceScore).toBe(92);
    expect(PLANNER_CLAIMS_FLOOR).toBe(30);
    expect(KNOWLEDGE_SCHEMA_VERSION).toBe(1);
    expect('dependsOn' in c).toBe(false);
  });
});
