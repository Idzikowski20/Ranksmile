import { projectCcmToCoverageSnapshot } from '@/src/core/intelligence/ccmToCoverageSnapshot';
import { compile } from '@/src/core/compiler/compile';
import type { CoverageSnapshot } from '@/src/core/domain/coverage/aiCoverage';

const FIXED_AT = '2026-08-03T12:00:00.000Z';

describe('projectCcmToCoverageSnapshot', () => {
  it('maps CCM intents+facts into CoverageSnapshot items', () => {
    const { model } = compile({
      articleId: 'proj-1',
      compiledAt: FIXED_AT,
      source: {
        kind: 'plain',
        text: '# Wojna hybrydowa\n\n## Przykłady\n\nRosja anektowała Krym w 2014 roku.\n',
      },
    });
    const snap = projectCcmToCoverageSnapshot(model, { createdAt: FIXED_AT });
    expect(snap.schemaVersion).toBe(1);
    expect(snap.judgeVersion).toContain('ccm-projection');
    expect(snap.items.some((i) => i.type === 'intent')).toBe(true);
    expect(snap.items.some((i) => i.category === 'knowledge')).toBe(true);
    expect(snap.overall).toBeGreaterThan(0);
    expect(snap.buckets.length).toBeGreaterThan(0);
  });

  it('merges previous paa/llmSources extras by label', () => {
    const { model } = compile({
      articleId: 'proj-2',
      compiledAt: FIXED_AT,
      source: {
        kind: 'plain',
        text: '# Temat\n\n## Sekcja\n\nFakt testowy bez roku ale wystarczająco długi aby wejść do IR.\n',
      },
    });
    const previous: CoverageSnapshot = {
      schemaVersion: 1,
      judgeVersion: 'legacy',
      promptVersion: 'v1',
      model: 'deepseek-chat',
      createdAt: '2026-01-01T00:00:00.000Z',
      items: [
        {
          id: 'paa-1',
          label: 'Pytanie z PAA',
          type: 'paa',
          category: 'knowledge',
          importance: 'recommended',
          source: 'paa',
          covered: false,
          quality: 0,
          llmSources: ['chat_gpt'],
        },
      ],
      buckets: [],
      answersMainQuestionEarly: false,
      overall: 0,
    };
    const snap = projectCcmToCoverageSnapshot(model, { createdAt: FIXED_AT, previous });
    expect(snap.items.some((i) => i.id === 'paa-1')).toBe(true);
    expect(snap.items.some((i) => i.llmSources?.includes('chat_gpt'))).toBe(true);
  });

  it('keeps knowledge items when CCM metadata has no query or title', () => {
    const { model } = compile({
      articleId: 'proj-no-query',
      compiledAt: FIXED_AT,
      source: { kind: 'plain', text: '# Heading\n\nA fact with enough detail to be indexed.' },
    });
    const withoutQuery = {
      ...model,
      metadata: { ...model.metadata, primaryQuery: undefined, title: undefined },
    };

    const snap = projectCcmToCoverageSnapshot(withoutQuery, { createdAt: FIXED_AT });

    expect(snap.items.some((item) => item.category === 'knowledge')).toBe(true);
  });
});

describe('projection preserves the grading rubric', () => {
  const rubricItem = (n: number) => ({
    id: `paa-${n}`,
    label: `Pytanie harvestowane numer ${n}?`,
    type: 'paa' as const,
    category: 'knowledge' as const,
    importance: 'critical' as const,
    source: 'paa' as const,
    covered: false,
    quality: 0,
    llmSources: ['chat_gpt' as const],
  });

  const factLines = Array.from({ length: 45 }, (_, i) => (
    `Fakt numer ${i} dotyczy roku ${1980 + i} i ma znaczenie dla całości tematu artykułu.`
  )).join('\n\n');

  const bigModel = () => compile({
    articleId: 'proj-cap',
    compiledAt: FIXED_AT,
    source: { kind: 'plain', text: `# Temat\n\n## Sekcja\n\n${factLines}\n` },
  }).model;

  // Rubric of 40 — larger than AI_COVERAGE_MAX (35). Article 13 fed the whole set
  // (rubric + CCM facts) through compaction, whose own cap + type/score filter dropped
  // most of the rubric off the tail; the article then self-graded against its own facts.
  const RUBRIC_SIZE = 40;
  const previous = (): CoverageSnapshot => ({
    schemaVersion: 1,
    judgeVersion: 'v1|deepseek-chat|0',
    promptVersion: 'v1',
    model: 'deepseek-chat',
    createdAt: '2026-01-01T00:00:00.000Z',
    items: Array.from({ length: RUBRIC_SIZE }, (_, i) => rubricItem(i)),
    buckets: [],
    answersMainQuestionEarly: false,
    overall: 0,
  });

  it('keeps the whole harvested rubric even when it alone exceeds the cap', () => {
    const snap = projectCcmToCoverageSnapshot(bigModel(), { createdAt: FIXED_AT, previous: previous() });

    const keptIds = new Set(snap.items.map((i) => i.id));
    for (let i = 0; i < RUBRIC_SIZE; i += 1) {
      expect(keptIds.has(`paa-${i}`)).toBe(true);
    }
  });

  it('keeps a true early-answer grade sticky across projections', () => {
    const graded = { ...previous(), answersMainQuestionEarly: true };

    const snap = projectCcmToCoverageSnapshot(bigModel(), { createdAt: FIXED_AT, previous: graded });

    expect(snap.answersMainQuestionEarly).toBe(true);
  });
});

describe('intent rows from a previous LLM grade', () => {
  it('survive the projection even though CCM models no intents', () => {
    const { model } = compile({
      articleId: 'proj-intent',
      compiledAt: FIXED_AT,
      source: {
        kind: 'plain',
        text: '# Szantaż emocjonalny\n\n## Objawy\n\nSprawca wywiera presję przez poczucie winy i lęk.\n',
      },
    });
    const previous: CoverageSnapshot = {
      schemaVersion: 1,
      judgeVersion: 'v1|deepseek-chat|0',
      promptVersion: 'v1',
      model: 'deepseek-chat',
      createdAt: '2026-01-01T00:00:00.000Z',
      items: [
        {
          id: 'intent-answer-early',
          label: 'Answer the main question early',
          type: 'intent',
          category: 'intent',
          importance: 'critical',
          source: 'llm',
          covered: true,
          quality: 5,
        },
        {
          id: 'intent-who',
          label: "Identify who it's for",
          type: 'intent',
          category: 'intent',
          importance: 'recommended',
          source: 'llm',
          covered: true,
          quality: 5,
        },
      ],
      buckets: [],
      answersMainQuestionEarly: true,
      overall: 60,
    };

    const snap = projectCcmToCoverageSnapshot(model, { createdAt: FIXED_AT, previous });

    // Without this, the intent bucket lands at max 0 with weight 3 and the AI Search
    // score is structurally capped no matter how well the intro answers the query.
    const carried = snap.items.filter((i) => i.id.startsWith('intent-'));
    expect(carried).toHaveLength(2);
    const intentBucket = snap.buckets.find((b) => b.key === 'intent');
    expect(intentBucket?.max).toBeGreaterThan(0);
  });
});
