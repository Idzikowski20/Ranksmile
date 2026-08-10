import { dropCompetitorBrandClaims, namesCompetitorBrand } from '../../../lib/knowledgeEngine/competitorBrands';
import type { CanonicalClaim } from '../../../lib/knowledgeEngine/types';

const KEYWORD = 'prywatny detektyw warszawa';
// The real SERP behind article 18.
const DOMAINS = ['agencjatemida.pl', 'expertus.pl', 'topdetektyw.pl', 'sprawdzonydetektyw.pl', 'grupa-alert.pl'];

function claim(statement: string, domain = 'agencjatemida.pl'): CanonicalClaim {
  return {
    id: `CLAIM_${statement.length}`,
    statement,
    cluster: 'Unassigned',
    importance: 'medium',
    importanceScore: 52,
    consensus: 0,
    evidence: [{
      kind: 'competitor',
      url: `https://${domain}/x`,
      domain,
      favicon: '',
      title: domain,
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
}

describe('namesCompetitorBrand', () => {
  it.each([
    // Both shipped in article 18 — our client's article asserting a rival's staff policy.
    'Nakaz ten dotyczy wszystkich pracowników Agencji Detektywistycznej Temida.',
    'Klienci Agencji Temida powierzają detektywom prywatne, sekretne sprawy.',
  ])('rejects the claim naming a competitor: %s', (statement) => {
    expect(namesCompetitorBrand(statement, DOMAINS, KEYWORD)).toBe(true);
  });

  it.each([
    // `detektyw` sits inside topdetektyw.pl and sprawdzonydetektyw.pl — without the
    // keyword guard this check would discard the entire topic.
    'Obserwacja osób jest jedną z najskuteczniejszych metod detektywistycznych.',
    'Detektywi wykorzystują nowoczesny sprzęt do obserwacji osób.',
    'Usługi detektywistyczne w Polsce wymagają licencji wydanej przez MSWiA.',
    'Prywatny detektyw w Warszawie działa na podstawie ustawy z 6 lipca 2001 r.',
  ])('keeps the on-topic claim: %s', (statement) => {
    expect(namesCompetitorBrand(statement, DOMAINS, KEYWORD)).toBe(false);
  });

  it('says no when the graph recorded no domains', () => {
    expect(namesCompetitorBrand('Agencja Temida działa w Warszawie.', [], KEYWORD)).toBe(false);
  });

  it('ignores short words that would match a hostname by accident', () => {
    // "alert" is 5 chars and really is in grupa-alert.pl, so it must go; "osob" is not.
    expect(namesCompetitorBrand('Detektyw prowadzi obserwacje osob w terenie.', DOMAINS, KEYWORD)).toBe(false);
  });
});

describe('dropCompetitorBrandClaims', () => {
  it('removes only the branded claims, keeping the rest', () => {
    const claims = [
      claim('Nakaz ten dotyczy wszystkich pracowników Agencji Detektywistycznej Temida.'),
      claim('Obserwacja osób jest jedną z najskuteczniejszych metod detektywistycznych.', 'expertus.pl'),
      claim('Detektywi wykorzystują nowoczesny sprzęt do obserwacji osób.', 'topdetektyw.pl'),
    ];

    const kept = dropCompetitorBrandClaims(claims, KEYWORD);

    expect(kept).toHaveLength(2);
    expect(kept.map((c) => c.statement)).not.toContain(claims[0].statement);
  });

  it('catches a brand named by a claim scraped from a different competitor', () => {
    // The union of every domain in the graph, not just the claim's own source — a real
    // graph carries claims from all five competitors, so agencjatemida.pl is known.
    const claims = [
      claim('Agencja Temida obsługuje osoby prywatne i firmy.', 'expertus.pl'),
      claim('Obserwacja osób wymaga zachowania pełnej dyskrecji.', 'agencjatemida.pl'),
    ];

    const kept = dropCompetitorBrandClaims(claims, KEYWORD);

    expect(kept).toHaveLength(1);
    expect(kept[0].statement).toBe('Obserwacja osób wymaga zachowania pełnej dyskrecji.');
  });

  it('returns the claims untouched when none carry evidence', () => {
    const bare = [{ ...claim('cokolwiek'), evidence: [] }];
    expect(dropCompetitorBrandClaims(bare, KEYWORD)).toHaveLength(1);
  });
});

/**
 * A plain `includes` fired on `agencjatemida`.includes(`agencja`), so the ordinary topic
 * word was treated as a brand — "Agencja detektywistyczna działa na terenie całej Polski",
 * a fact on the reference tool's own list, was thrown away. In a concatenated host the
 * brand is the distinctive tail; the head is the generic word.
 */
describe('the brand match is anchored at the end of the hostname', () => {
  const HOSTS = ['agencjatemida.pl', 'topdetektyw.pl'];

  it('keeps a generic topic word that merely prefixes a competitor host', () => {
    expect(namesCompetitorBrand(
      'Agencja detektywistyczna dziala na terenie calej Polski.', HOSTS, KEYWORD,
    )).toBe(false);
  });

  it('still drops the brand itself', () => {
    expect(namesCompetitorBrand(
      'Klienci Agencji Temida powierzaja detektywom sekretne sprawy.', HOSTS, KEYWORD,
    )).toBe(true);
  });

  it('leaves an unrelated fact alone', () => {
    expect(namesCompetitorBrand(
      'Uslugi detektywistyczne wymagaja licencji wydanej przez MSWiA.', HOSTS, KEYWORD,
    )).toBe(false);
  });
});
