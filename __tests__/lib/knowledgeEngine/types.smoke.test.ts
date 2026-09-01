import type { DistributionStats } from '../../../lib/benchmarkIntelligence/types';
import type { CanonicalClaim } from '../../../lib/knowledgeEngine';
import {
  KNOWLEDGE_SCHEMA_VERSION,
  PLANNER_CLAIMS_FLOOR,
  buildKnowledgeGraph,
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
    expect(PLANNER_CLAIMS_FLOOR).toBe(12);
    expect(KNOWLEDGE_SCHEMA_VERSION).toBe(1);
    expect('dependsOn' in c).toBe(false);
  });

  it('buildKnowledgeGraph deeply freezes nested evidence roles', () => {
    const graph = buildKnowledgeGraph({
      claims: [{
        id: 'CLAIM_1',
        statement: 'SSL is required.',
        cluster: 'Tech',
        importance: 'high',
        importanceScore: 70,
        consensus: 0.5,
        evidence: [{
          kind: 'competitor',
          url: 'https://example.com',
          domain: 'example.com',
          favicon: '',
          title: 'Ex',
          weight: 1,
          roles: ['serp'],
          serpPositions: [1],
        }],
        usedByCompetitors: 1,
        competitorsTotal: 2,
        usedInSections: [],
        generatedFrom: ['serp'],
        sourceDiversity: {
          official: false, competitors: true, aiOverview: false, paa: false, score: 0.25,
        },
        consensusExplanation: { percent: 50, because: [] },
      }],
      entities: [],
      topicBlocks: [],
      gaps: [],
      competitors: [],
      stageTimingsMs: {
        extract: 0, normalize: 0, canonicalize: 0, vote: 0, cluster: 0, build: 0, verify: 0,
      },
      verifier: { ok: true, issues: [] },
    });
    expect(Object.isFrozen(graph)).toBe(true);
    expect(Object.isFrozen(graph.claims[0])).toBe(true);
    expect(Object.isFrozen(graph.claims[0].evidence[0])).toBe(true);
    expect(Object.isFrozen(graph.claims[0].evidence[0].roles)).toBe(true);
    expect(() => {
      (graph.claims[0].evidence[0].roles as string[]).push('official');
    }).toThrow();
  });
});
