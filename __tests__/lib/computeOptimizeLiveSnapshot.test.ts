import { computeOptimizeLiveSnapshot } from '../../lib/computeLiveArticleScores';
import {
  computeAiSearchScore,
  computeOverallContentScore,
  type AiVisibilitySummary,
} from '../../lib/aiSearchScore';
import type { CoverageItem } from '../../lib/aiCoverage';
import type { ScoreData } from '../../lib/contentScore';

const coverageItems: CoverageItem[] = [
  {
    id: 'paa-1',
    label: 'Kiedy można zgłosić nękanie?',
    type: 'paa',
    category: 'knowledge',
    importance: 'recommended',
    source: 'llm',
    covered: false,
    quality: 0,
  },
];

const scoreData: ScoreData = {
  terms: [{ term: 'nękanie', target_count: 3, current_count: 0 }],
  words_target: 1500,
  words_min: 1000,
  words_max: 2500,
  headings_target: 10,
  headings_min: 5,
  headings_max: 20,
  paragraphs_target: 15,
  paragraphs_min: 8,
  paragraphs_max: 30,
  competitor_count: 5,
  paa_questions: [],
  ai_score: 0,
};

const healthySummary = (): AiVisibilitySummary => ({
  prompts_total: 10,
  prompts_cited: 6,
  competitor_citations: 2,
  extractability_score: 70,
  citations: Array.from({ length: 10 }, (_, i) => ({
    prompt: `prompt ${i}`,
    answer_readiness_score: 70,
  })),
});

describe('computeOptimizeLiveSnapshot', () => {
  it('returns seo, ai, and overall from the same content pass', () => {
    const html = '<h1>Nękanie</h1><p>Kiedy można zgłosić nękanie? Nękanie to poważny problem.</p>';
    const snap = computeOptimizeLiveSnapshot({
      editorHtml: html,
      scoreData,
      keyword: 'nękanie',
      coverageItems,
      coverageSnapshot: null,
      substitutePlaceholders: (h) => h,
    });
    expect(snap.overall).toBe(computeOverallContentScore(snap.seo, snap.ai));
  });

  it('does not collapse AI Search to 0 when live coverage fails but citation summary is healthy', () => {
    // AO rewrite can break FAQ presence checks → live coverage 0 while idle resolveAiScore stays ~65.
    const items: CoverageItem[] = [
      {
        id: 'q1',
        label: 'Kiedy da sie uzyskac zakaz zblizania sie?',
        type: 'question',
        category: 'knowledge',
        importance: 'critical',
        source: 'llm',
        covered: true,
        quality: 5,
      },
      {
        id: 'q2',
        label: 'Kto moze nalozic zakaz policja',
        type: 'paa',
        category: 'knowledge',
        importance: 'recommended',
        source: 'llm',
        covered: true,
        quality: 4,
      },
    ];
    const badHtml =
      '<h1>Tytul</h1><p>Ogolny tekst bez slowa kluczowego z pytan.</p><p>Drugi paragraf tez ogolny bez FAQ.</p>';
    const summary = healthySummary();
    const expected = computeAiSearchScore(summary);

    const snap = computeOptimizeLiveSnapshot({
      editorHtml: badHtml,
      scoreData,
      keyword: 'zakaz',
      coverageItems: items,
      coverageSnapshot: null,
      aiVisibilitySummary: summary,
      substitutePlaceholders: (h) => h,
    });

    expect(snap.ai).toBe(expected);
    expect(snap.ai).toBeGreaterThan(0);
    expect(snap.overall).toBe(computeOverallContentScore(snap.seo, snap.ai));
  });
});
