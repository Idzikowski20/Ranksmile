import {
  canonicalizeClaims,
  getEmbeddingProvider,
  isLocalLeftoverEntity,
  semanticMatchScore,
  shouldUseKnowledgePlanner,
  verifyKnowledgeGraph,
  voteClaims,
  SOURCE_TIER_WEIGHTS,
  buildKnowledgeGraph,
  buildCompetitorDocuments,
  runKnowledgeEngine,
  KNOWLEDGE_CONSENSUS_MIN,
  CANONICALIZE_SIM_MIN,
} from '../../../lib/knowledgeEngine';
import type { CanonicalClaim, CompetitorDocument } from '../../../lib/knowledgeEngine';

describe('sourceWeight tiers', () => {
  it('uses fixed tiers', () => {
    expect(SOURCE_TIER_WEIGHTS.official).toBe(1);
    expect(SOURCE_TIER_WEIGHTS.industry).toBe(0.9);
    expect(SOURCE_TIER_WEIGHTS.competitor).toBe(0.75);
    expect(SOURCE_TIER_WEIGHTS.ai_overview).toBe(0.7);
    expect(SOURCE_TIER_WEIGHTS.paa).toBe(0.6);
  });
});

describe('semanticMatch', () => {
  it('scores identical text high and unrelated low', async () => {
    const provider = getEmbeddingProvider();
    const same = await semanticMatchScore(
      'Szybkość ładowania strony wpływa na ranking w Google.',
      'Szybkość ładowania strony wpływa na ranking w Google.',
      provider,
    );
    const unrelated = await semanticMatchScore(
      'Certyfikat SSL jest wymagany dla bezpiecznego połączenia HTTPS.',
      'Warszawa jest stolicą Polski i dużym miastem wojewódzkim.',
      provider,
    );
    expect(same).toBeGreaterThan(0.99);
    expect(unrelated).toBeLessThan(CANONICALIZE_SIM_MIN);
  });
});

describe('normalize leftovers', () => {
  it('drops cities and holidays', () => {
    expect(isLocalLeftoverEntity('Warszawa')).toBe(true);
    expect(isLocalLeftoverEntity('wesołych świąt wielkanocnych 2026')).toBe(true);
    expect(isLocalLeftoverEntity('Google Search Console')).toBe(false);
  });
});

describe('canonicalize', () => {
  it('merges near-duplicate paraphrases', async () => {
    const out = await canonicalizeClaims([
      {
        text: 'Szybkość ładowania strony wpływa na ranking w Google.',
        url: 'https://a.pl/x',
        kind: 'competitor',
      },
      {
        text: 'Szybkość ładowania strony wpływa na ranking Google.',
        url: 'https://b.pl/y',
        kind: 'competitor',
      },
    ], { provider: getEmbeddingProvider() });
    expect(out).toHaveLength(1);
    expect(out[0].evidence.length).toBe(2);
    expect(out[0].generatedFrom).toContain('serp');
  });

  it('does not merge unrelated claims', async () => {
    const out = await canonicalizeClaims([
      {
        text: 'Certyfikat SSL jest wymagany dla bezpiecznego połączenia na stronie.',
        url: 'https://a.pl',
        kind: 'competitor',
      },
      {
        text: 'Linkowanie wewnętrzne poprawia indeksowanie podstron witryny.',
        url: 'https://b.pl',
        kind: 'competitor',
      },
    ], { provider: getEmbeddingProvider() });
    expect(out.length).toBe(2);
  });
});

describe('voteClaims', () => {
  it('downweights weak-only support', () => {
    const claim: CanonicalClaim = {
      id: 'CLAIM_x',
      statement: 'Test claim about technical SEO foundations clearly.',
      cluster: 'Technical SEO',
      importance: 'medium',
      importanceScore: 50,
      consensus: 0,
      evidence: [{
        kind: 'competitor',
        url: 'https://weak.pl',
        domain: 'weak.pl',
        favicon: '',
        title: 'weak',
        weight: 0.75,
        roles: ['serp'],
      }],
      usedByCompetitors: 0,
      competitorsTotal: 0,
      usedInSections: [],
      generatedFrom: ['serp'],
      sourceDiversity: { official: false, competitors: true, aiOverview: false, paa: false, score: 0.25 },
      consensusExplanation: { percent: 0, because: [] },
    };
    const docs: CompetitorDocument[] = [
      {
        url: 'https://weak.pl',
        title: 'w',
        score: 42,
        authority: 0.3,
        headings: [],
        entities: [],
        claimIds: [],
        topicBlockIds: [],
        serpPosition: 8,
      },
      {
        url: 'https://strong.pl',
        title: 's',
        score: 98,
        authority: 0.95,
        headings: [],
        entities: [],
        claimIds: [],
        topicBlockIds: [],
        serpPosition: 1,
      },
    ];
    const voted = voteClaims([claim], docs);
    expect(voted[0].consensus).toBeLessThan(KNOWLEDGE_CONSENSUS_MIN);
  });
});

describe('verifier + freeze', () => {
  it('rejects claims without evidence', () => {
    const bad = buildKnowledgeGraph({
      claims: [{
        id: 'CLAIM_bad',
        statement: 'Empty evidence claim that should fail verification rules.',
        cluster: 'X',
        importance: 'low',
        importanceScore: 10,
        consensus: 0.9,
        evidence: [],
        usedByCompetitors: 0,
        competitorsTotal: 1,
        usedInSections: [],
        generatedFrom: ['serp'],
        sourceDiversity: { official: false, competitors: false, aiOverview: false, paa: false, score: 0 },
        consensusExplanation: { percent: 90, because: [] },
      }],
      entities: [],
      topicBlocks: [],
      gaps: [],
      competitors: [],
      stageTimingsMs: {
        extract: 1, normalize: 1, canonicalize: 1, vote: 1, cluster: 1, build: 1, verify: 1,
      },
      verifier: { ok: true, issues: [] },
    });
    const r = verifyKnowledgeGraph(bad);
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.code === 'claim_without_evidence')).toBe(true);
  });

  it('freezes graph claims array', () => {
    const g = buildKnowledgeGraph({
      claims: [{
        id: 'CLAIM_ok',
        statement: 'SSL certificate is required for secure HTTPS connections online.',
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
      }],
      entities: [],
      topicBlocks: [{
        id: 'TB_1',
        title: 'Technical SEO',
        role: 'FOUNDATION',
        consensus: 1,
        memberHeadings: ['Technical SEO'],
        claimIds: ['CLAIM_ok'],
      }],
      gaps: [],
      competitors: [],
      stageTimingsMs: {
        extract: 1, normalize: 1, canonicalize: 1, vote: 1, cluster: 1, build: 1, verify: 1,
      },
      verifier: { ok: true, issues: [] },
    });
    expect(Object.isFrozen(g)).toBe(true);
    expect(Object.isFrozen(g.claims)).toBe(true);
    expect(() => {
      (g.claims as CanonicalClaim[]).push(g.claims[0]);
    }).toThrow();
  });
});

describe('competitor documents + gate', () => {
  it('reads H2 texts from outlines cache', () => {
    const docs = buildCompetitorDocuments({
      outlinesCache: JSON.stringify([
        {
          url: 'https://a.example/seo',
          title: 'A',
          serp_position: 1,
          headings: [
            { level: 2, text: 'Analiza słów kluczowych' },
            { level: 3, text: 'Ignored H3' },
          ],
        },
      ]),
    });
    expect(docs[0].headings).toEqual(['Analiza słów kluczowych']);
  });

  it('shouldUseKnowledgePlanner respects flag and floor', () => {
    expect(shouldUseKnowledgePlanner(null, false).reason).toBe('flag_off');
    expect(shouldUseKnowledgePlanner(null, true).reason).toBe('verifier_fail');
  });
});

describe('knowledgeGraphToTargetKg', () => {
  it('maps high-consensus claims into Target KG', async () => {
    const { knowledgeGraphToTargetKg } = await import('../../../lib/knowledgeEngine/toTargetKg');
    const g = buildKnowledgeGraph({
      claims: [{
        id: 'CLAIM_ok',
        statement: 'SSL certificate is required for secure HTTPS connections online.',
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
      }],
      entities: [{
        term: 'SSL',
        docsHit: 1,
        competitorsTotal: 1,
        consensus: 1,
        importance: 'high',
        importanceScore: 100,
      }],
      topicBlocks: [],
      gaps: [],
      competitors: [],
      stageTimingsMs: {
        extract: 1, normalize: 1, canonicalize: 1, vote: 1, cluster: 1, build: 1, verify: 1,
      },
      verifier: { ok: true, issues: [] },
    });
    const kg = knowledgeGraphToTargetKg(g, ['Ile trwa SEO?']);
    expect(kg.claims).toHaveLength(1);
    expect(kg.claims[0].id).toBe('CLAIM_ok');
    expect(kg.entities).toContain('SSL');
    expect(kg.questions.some((q) => q.question.includes('Ile trwa'))).toBe(true);
    expect(shouldUseKnowledgePlanner(g, true).reason).toBe('below_floor');
  });
});

describe('runKnowledgeEngine smoke', () => {
  it('does not pad heading seeds with SEO boilerplate', async () => {
    const { graph } = await runKnowledgeEngine({
      keyword: 'jak pozycjonować stronę',
      outlinesCache: JSON.stringify([
        {
          url: 'https://a.example/seo',
          title: 'A',
          serp_position: 1,
          headings: [
            { level: 2, text: 'Techniczne SEO i indeksowanie stron internetowych' },
          ],
        },
      ]),
      extraTexts: [],
    });
    for (const c of graph.claims) {
      expect(c.statement).not.toMatch(/Temat omawiany w przewodniku SEO/i);
    }
  });

  it('returns frozen graph with timings under soft budget', async () => {
    const { graph, stageTimingsMs } = await runKnowledgeEngine({
      keyword: 'jak pozycjonować stronę',
      outlinesCache: JSON.stringify([
        {
          url: 'https://a.example/seo',
          title: 'A',
          serp_position: 1,
          headings: [
            { level: 2, text: 'Techniczne SEO i indeksowanie' },
            { level: 2, text: 'Analiza słów kluczowych' },
          ],
        },
        {
          url: 'https://b.example/seo',
          title: 'B',
          serp_position: 2,
          headings: [
            { level: 2, text: 'Techniczne SEO' },
            { level: 2, text: 'Dobór słów kluczowych' },
          ],
        },
      ]),
      extraTexts: [
        {
          text: 'Certyfikat SSL jest wymagany dla bezpiecznego połączenia na stronie internetowej. Linkowanie wewnętrzne poprawia indeksowanie podstron.',
          url: 'https://a.example/seo',
        },
      ],
      paaQuestions: ['Ile trwa pozycjonowanie?'],
    });
    expect(Object.isFrozen(graph)).toBe(true);
    expect(graph.knowledge_version).toBe(1);
    expect(stageTimingsMs.canonicalize).toBeGreaterThanOrEqual(0);
    const total = Object.values(stageTimingsMs).reduce((a, b) => a + b, 0);
    expect(total).toBeLessThan(2000);
  });
});
