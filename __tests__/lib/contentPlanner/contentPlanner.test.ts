import {
  buildCompetitorBenchmark,
  buildCompetitorProfiles,
  buildIntentBlueprint,
  buildReaderModel,
  h2FromWords,
  runContentPlanner,
  synthesizeCompetitors,
  validateBlueprint,
} from '../../../lib/contentPlanner';

function sampleCompetitors() {
  return buildCompetitorProfiles([
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
      ],
      questions: [
        'Ile trwa pozycjonowanie?',
        'Czy można pozycjonować samemu?',
        'Ile kosztuje SEO?',
      ],
      entities: ['google search console', 'ssl', 'core web vitals'],
      openingPattern: 'problem_first',
    },
    {
      url: 'https://b.example/seo',
      position: 2,
      wordCount: 3400,
      paragraphs: 85,
      headings: 14,
      lists: 18,
      tables: 3,
      images: 3,
      faq: 5,
      examples: 8,
      claims: [
        'Certyfikat SSL jest wymagany',
        'Google ocenia strony mobile-first',
        'robots.txt wpływa na indeksację',
        'Długie frazy mają wyższą konwersję',
      ],
      questions: [
        'Ile trwa pozycjonowanie?',
        'Jakie narzędzia SEO?',
      ],
      entities: ['ssl', 'robots.txt', 'ahrefs'],
    },
    {
      url: 'https://c.example/seo',
      position: 3,
      wordCount: 3800,
      paragraphs: 100,
      headings: 16,
      lists: 22,
      tables: 1,
      images: 5,
      faq: 7,
      examples: 12,
      claims: [
        'Certyfikat SSL jest wymagany',
        'Komenda site: sprawdza indeksację',
        'PageSpeed Insights mierzy LCP',
      ],
      questions: [
        'Jak zacząć pozycjonowanie?',
        'Jakie błędy unikać?',
      ],
      entities: ['pagespeed insights', 'ssl'],
      sources: ['https://developers.google.com'],
    },
  ]);
}

describe('Content Planner v2 — Intent + Reader', () => {
  it('builds beginner step-by-step intent without brand niche', () => {
    const intent = buildIntentBlueprint({
      keyword: 'jak pozycjonować stronę',
      year: 2026,
      allowBrandNiche: false,
    });
    expect(intent.articleType).toBe('step-by-step');
    expect(intent.allowBrandNiche).toBe(false);

    const reader = buildReaderModel({
      intent,
      brandNicheHint: 'agencja detektywistyczna',
    });
    expect(reader.readerPersona).toBe('beginner');
    expect(reader.goal.toLowerCase()).not.toMatch(/detektyw/);
    expect(reader.fears.some((f) => /koszt/i.test(f))).toBe(true);
  });
});

describe('Content Planner v2 — Competitor Benchmark', () => {
  it('derives recommended words and adaptive H2 from profiles', () => {
    const profiles = sampleCompetitors();
    const synth = synthesizeCompetitors(profiles);
    const bench = buildCompetitorBenchmark(synth);
    expect(synth.competitorCount).toBe(3);
    expect(bench.targetWords).toBeGreaterThanOrEqual(3400);
    expect(h2FromWords(bench.targetWords)).toBeGreaterThanOrEqual(11);
    expect(synth.commonClaims.some((c) => c.includes('ssl'))).toBe(true);
  });
});

describe('Content Planner v2 — Planning gates + article', () => {
  it('uses partial topic blocks without replacing the legacy knowledge graph', () => {
    const result = runContentPlanner({
      keyword: 'jak reagować na szantaż',
      language: 'pl',
      competitors: [{
        url: 'https://example.com/szantaz',
        position: 1,
        wordCount: 2200,
        paragraphs: 55,
        headings: 9,
        lists: 5,
        tables: 1,
        images: 2,
        faq: 3,
        examples: 4,
        claims: [
          'Nie należy płacić szantażyście.',
          'Wiadomości trzeba zabezpieczyć jako dowody.',
          'Groźby można zgłosić organom ścigania.',
          'Szybka reakcja ogranicza ryzyko eskalacji.',
          'Pomoc prawna porządkuje dalsze działania.',
          'Wsparcie psychologiczne pomaga odzyskać kontrolę.',
        ],
        questions: ['Co zrobić natychmiast?', 'Jak zabezpieczyć dowody?', 'Gdzie zgłosić szantaż?'],
        entities: ['szantaż', 'dowody', 'policja'],
      }],
      topicBlocks: [{
        id: 'topic-emergency',
        title: 'Procedura bezpieczeństwa krok po kroku',
        role: 'ACTION',
        consensus: 0.9,
        memberHeadings: [],
        claimIds: [],
      }],
      produceArticle: false,
    });

    expect(result.bundle.targetKg.claims).toHaveLength(6);
    expect(result.blueprintValidation.ok).toBe(true);
    expect(result.bundle.outline?.sections.some((section) => (
      section.heading === 'Procedura bezpieczeństwa krok po kroku'
    ))).toBe(true);
  });

  it('passes blueprint/outline gates and improves coverage via KCE', () => {
    const profiles = sampleCompetitors();
    const result = runContentPlanner({
      keyword: 'jak pozycjonować stronę',
      year: 2026,
      allowBrandNiche: false,
      brandNicheHint: 'detektyw Warszawa',
      competitors: profiles.map((p) => ({
        url: p.url,
        position: p.position,
        wordCount: p.wordCount,
        paragraphs: p.paragraphs,
        headings: p.headings,
        lists: p.lists,
        tables: p.tables,
        images: p.images,
        faq: p.faq,
        examples: p.examples,
        claims: p.claims,
        questions: p.questions,
        entities: p.entities,
        sources: p.sources,
        openingPattern: p.openingPattern,
      })),
      ai: {
        claims: ['Certyfikat SSL jest wymagany', 'AI Overviews pojawiają się w SERP'],
        questions: ['Czy Google Ads zastępuje SEO?'],
        sources: [{ url: 'https://developers.google.com/search', label: 'Google', confidence: 1 }],
      },
      paaQuestions: ['Jak mierzyć efekty SEO?'],
      produceArticle: true,
      builtAt: '2026-08-03T00:00:00.000Z',
    });

    expect(result.blueprintValidation.ok).toBe(true);
    expect(validateBlueprint(result.bundle.blueprint).ok).toBe(true);
    expect(result.canWrite).toBe(true);
    expect(result.outlineValidation.ok).toBe(true);
    expect(result.briefValidation.ok).toBe(true);
    expect(result.bundle.reader.readerPersona).toBe('beginner');
    expect(result.bundle.blueprint.targetWords).toBeGreaterThan(3000);
    expect(result.bundle.outline?.sections.length).toBeGreaterThanOrEqual(11);
    expect(result.bundle.targetKg.claims.length).toBeGreaterThan(5);
    expect(result.bundle.targetKg.questions.length).toBeGreaterThan(3);

    // Brand niche must not pollute primary entities path
    expect(result.bundle.targetKg.entities.join(' ').toLowerCase()).not.toMatch(/detektyw/);

    expect(result.html).toBeTruthy();
    expect(result.html!).toMatch(/<h1>/i);
    expect(result.postWrite).toBeTruthy();
    expect(result.postWrite!.coverageAfter).toBeGreaterThanOrEqual(result.postWrite!.coverageBefore);
    expect(result.bundle.rewritePlan).toBeTruthy();
  });

  it('does not produce html when canWrite is false', () => {
    const result = runContentPlanner({
      keyword: 'x',
      competitors: [],
      produceArticle: true,
    });
    expect(result.canWrite).toBe(false);
    expect(result.html).toBeUndefined();
  });
});
