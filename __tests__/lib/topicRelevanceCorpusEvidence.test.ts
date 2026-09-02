/** @jest-environment node */
/**
 * Corpus-evidence gate in filterNlpTermsForAnalysis, against a real SERP term set.
 *
 * The fixture is the 85 terms stored for a live "prywatny detektyw warszawa" article.
 * Competitor boilerplate — footer contact labels, a street name, staff names, generic
 * adjectives — was reaching the scoring list, so the terms slot was graded against a
 * target the writer could never legitimately hit.
 */
import fixture from '../fixtures/serpTerms.detective.json';
import { filterNlpTermsForAnalysis, filterOnTopicTerms } from '@/src/core/domain/relevance/topicRelevance';

type FixtureTerm = { term: string; doc_freq?: number; salience?: number; relevance?: number; target_count?: number };

const { seedKeyword, terms } = fixture as { seedKeyword: string; terms: FixtureTerm[] };

const kept = (): Set<string> => new Set(filterNlpTermsForAnalysis(terms, seedKeyword).map((t) => t.term));

/**
 * Boilerplate that repeats across competitor pages. High doc_freq is its signature —
 * every page of every detective site carries the same footer — so corpus evidence must
 * not be a free pass on its own.
 */
const BOILERPLATE = [
  'e mail',      // doc_freq 5 — contact label
  'zobacz',      // doc_freq 5 — nav CTA
  'numer',       // doc_freq 4 — phone label
  'napisz',      // doc_freq 2 — nav CTA
  'google',      // doc_freq 2 — analytics/maps mention
  'żurawia',     // doc_freq 2 — a competitor's street
  'empatia',     // doc_freq 2
];

/**
 * Terms admitted purely because they were a single word of 8+ characters. The rule
 * carries no topical test at all, so it let in generic marketing copy and a voivodeship.
 */
const LONE_LONG_WORDS = [
  'Całodobowo', 'mazowieckie', 'profesjonalne', 'Skuteczne', 'dyskretna',
  'informacji', 'klientów', 'Jesteśmy', 'kontrolowana', 'poznaniu',
];

/** Domain vocabulary the corpus genuinely establishes — must survive the tightening. */
const ON_TOPIC = [
  'wywiad gospodarczy',   // doc_freq 7
  'poszukiwanie osób',    // doc_freq 7
  'wywiad',               // doc_freq 7
  'agencja detektywistyczna',
  'usługi detektywistyczne',
  'wykrywanie podsłuchów',
];

describe('filterNlpTermsForAnalysis — corpus evidence must not outvote topicality', () => {
  it('drops competitor boilerplate that only has doc_freq going for it', () => {
    const out = kept();
    expect(BOILERPLATE.filter((t) => out.has(t))).toEqual([]);
  });

  it('drops lone long words admitted with no topical test', () => {
    const out = kept();
    expect(LONE_LONG_WORDS.filter((t) => out.has(t))).toEqual([]);
  });

  it('keeps domain vocabulary the corpus establishes', () => {
    const out = kept();
    expect(ON_TOPIC.filter((t) => !out.has(t))).toEqual([]);
  });

  it('cuts the list roughly in half without gutting it', () => {
    const out = kept();
    // Measured on this fixture: 73 terms before, ~42 after — noise 46 → 19.
    expect(out.size).toBeLessThan(50);
    expect(out.size).toBeGreaterThan(filterOnTopicTerms(terms, seedKeyword).length);
  });
});
