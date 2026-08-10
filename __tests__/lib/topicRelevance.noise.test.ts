import { filterNlpTermsForAnalysis } from '../../lib/topicRelevance';

const KEYWORD = 'prywatny detektyw warszawa';

/**
 * Every string here was graded against a real article. All contain "detektyw", so every
 * seed check passed them into the strict set — 92 of article 17's 151 terms were
 * uncoverable by construction, and the SEO score was measured against them anyway.
 */
const NOISE = [
  'philip prywatny detektyw z ksiazek raymonda chandlera',
  'agencja detektywistyczna kob group prywatny detektyw warszawa srodmiescie',
  'czarna pantera prywatny detektyw lublin agencja detektywistyczna opinie',
  'prywatny detektyw jelenia gora cennik',
  'prywatny detektyw zielona gora cennik',
  'operand prywatny detektyw katowice',
];

const REAL = [
  'wykrywanie podsluchow',
  'wywiad gospodarczy',
  'materialow dowodowych',
  'agencja detektywistyczna w warszawie',
  'sprawy rozwodowej',
];

function run(terms: string[]) {
  return filterNlpTermsForAnalysis(terms.map((term) => ({ term, doc_freq: 3 })), KEYWORD)
    .map((t) => t.term);
}

describe('filterNlpTermsForAnalysis noise', () => {
  it.each(NOISE)('drops the search suggestion %s', (term) => {
    expect(run([term])).toEqual([]);
  });

  it.each(REAL)('keeps the real term %s', (term) => {
    expect(run([term])).toEqual([term]);
  });

  it('keeps the city the article is actually about', () => {
    expect(run(['uslugi detektywistyczne warszawa'])).toEqual(['uslugi detektywistyczne warszawa']);
  });

  it('drops another city even when the phrase is short', () => {
    expect(run(['detektyw katowice'])).toEqual([]);
  });

  it('separates the real terms from the noise in one pass', () => {
    expect(run([...NOISE, ...REAL]).sort()).toEqual([...REAL].sort());
  });
});
