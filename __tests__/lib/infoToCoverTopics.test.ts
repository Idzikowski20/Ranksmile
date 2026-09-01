import { buildInfoToCoverTopics } from '../../lib/infoToCoverTopics';
import type { CoverageItem } from '../../lib/aiCoverage';
import type { AiVisibilitySummary } from '../../lib/aiSearchScore';

describe('buildInfoToCoverTopics', () => {
  it('falls back to aiSummary citations when coverageItems are empty', () => {
    const aiSummary: AiVisibilitySummary = {
      prompts_total: 2,
      prompts_cited: 0,
      competitor_citations: 0,
      extractability_score: 40,
      citations: [
        { prompt: 'Co to jest wojna hybrydowa?', answer_readiness_score: 20 },
        { prompt: 'Jakie są przykłady wojny hybrydowej?', answer_readiness_score: 10 },
        { prompt: 'Co to jest wojna hybrydowa?', answer_readiness_score: 5 }, // dup
      ],
    };

    const { intent, topics } = buildInfoToCoverTopics({ aiSummary, coverageItems: [] });
    const facts = [
      ...intent.map((f) => f.text),
      ...topics.flatMap((t) => t.facts.map((f) => f.text)),
    ];
    expect(facts).toContain('Co to jest wojna hybrydowa?');
    expect(facts).toContain('Jakie są przykłady wojny hybrydowej?');
    expect(facts.filter((t) => t === 'Co to jest wojna hybrydowa?')).toHaveLength(1);
  });

  it('prefers coverageItems over aiSummary when both exist', () => {
    const coverageItems: CoverageItem[] = [{
      id: 'paa-1',
      label: 'Czym różni się wojna hybrydowa od konfliktu zbrojnego?',
      type: 'paa',
      category: 'knowledge',
      importance: 'critical',
      source: 'paa',
      covered: false,
      quality: 0,
    }];
    const aiSummary: AiVisibilitySummary = {
      prompts_total: 1,
      prompts_cited: 0,
      competitor_citations: 0,
      extractability_score: 10,
      citations: [{ prompt: 'Co to jest wojna hybrydowa?' }],
    };

    const { topics } = buildInfoToCoverTopics({ aiSummary, coverageItems });
    const labels = topics.flatMap((t) => t.facts.map((f) => f.text));
    expect(labels).toContain('Czym różni się wojna hybrydowa od konfliktu zbrojnego?');
    expect(labels).not.toContain('Co to jest wojna hybrydowa?');
  });

  it('prefers snapshot.topics grouping when provided', () => {
    const coverageItems: CoverageItem[] = [
      {
        id: 'paa-1',
        label: 'Czym różni się wojna hybrydowa od konfliktu zbrojnego?',
        type: 'paa',
        category: 'knowledge',
        importance: 'critical',
        source: 'paa',
        covered: false,
        quality: 0,
        llmSources: ['gemini', 'chat_gpt'],
      },
      {
        id: 'paa-2',
        label: 'Jakie są przykłady wojny hybrydowej?',
        type: 'paa',
        category: 'knowledge',
        importance: 'recommended',
        source: 'paa',
        covered: true,
        quality: 3,
        llmSources: ['ai_overview'],
      },
    ];

    const { topics } = buildInfoToCoverTopics({
      coverageItems,
      snapshotTopics: [
        { title: 'Definicja i różnice', itemIds: ['paa-1'] },
        { title: 'Przykłady', itemIds: ['paa-2'] },
      ],
    });

    expect(topics.map((t) => t.title)).toEqual(['Definicja i różnice', 'Przykłady']);
    expect(topics[0]!.facts[0]!.sources.map((s) => s.kind).sort()).toEqual(['gemini', 'openai'].sort());
    expect(topics[1]!.facts[0]!.sources[0]!.kind).toBe('ai_overview');
  });
});
