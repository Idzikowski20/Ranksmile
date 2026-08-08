import { projectCcmToCoverageSnapshot } from '../../../lib/intelligence/ccmToCoverageSnapshot';
import { compile } from '../../../lib/compiler/compile';
import type { CoverageSnapshot } from '../../../lib/aiCoverage';

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

  const previous = (): CoverageSnapshot => ({
    schemaVersion: 1,
    judgeVersion: 'v1|deepseek-chat|0',
    promptVersion: 'v1',
    model: 'deepseek-chat',
    createdAt: '2026-01-01T00:00:00.000Z',
    items: Array.from({ length: 10 }, (_, i) => rubricItem(i)),
    buckets: [],
    answersMainQuestionEarly: false,
    overall: 0,
  });

  /**
   * Article 13: the cap sliced the carried-over rubric off the tail, leaving 2 of 10
   * harvested questions — the article then self-graded 33/33 against its own facts.
   */
  it('never trades harvested questions for its own facts under the cap', () => {
    const snap = projectCcmToCoverageSnapshot(bigModel(), { createdAt: FIXED_AT, previous: previous() });

    const kept = snap.items.filter((i) => i.id.startsWith('paa-'));
    expect(kept).toHaveLength(10);
  });

  it('keeps a true early-answer grade sticky across projections', () => {
    const graded = { ...previous(), answersMainQuestionEarly: true };

    const snap = projectCcmToCoverageSnapshot(bigModel(), { createdAt: FIXED_AT, previous: graded });

    expect(snap.answersMainQuestionEarly).toBe(true);
  });
});
