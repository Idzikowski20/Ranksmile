import { computeOptimizeLiveSnapshot } from '../../lib/computeLiveArticleScores';
import { computeOverallContentScore } from '../../lib/aiSearchScore';
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
};

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
});
