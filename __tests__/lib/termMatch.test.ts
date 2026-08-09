import { countOccurrences } from '../../lib/termMatch';
import { filterUsefulNlpTerms } from '../../lib/competitorTermCalibration';
import type { NlpTerm } from '../../lib/contentScore';

/** Shape produced by python-sidecar/analyzers/term_lemmas.py. */
const USLUGI_RX = ['(?:usługami|usługach|usługi|usługa|usług)', '(?:detektywistycznych|detektywistyczne|detektywistyczna)'];

describe('countOccurrences with lemma regexps', () => {
  it('counts every declension the alternation covers', () => {
    const text = 'Nasze usługi detektywistyczne są legalne. Koszt usług detektywistycznych '
      + 'zależy od sprawy. Usługa detektywistyczna wymaga licencji.';

    expect(countOccurrences(text, 'usługi detektywistyczne', USLUGI_RX)).toBe(3);
    // The fuzzy fallback on the same text, for contrast, is what regexps replace.
    expect(countOccurrences(text, 'usługi detektywistyczne')).toBeGreaterThanOrEqual(1);
  });

  it('does not overmatch a different word sharing a prefix', () => {
    const rx = ['(?:detektywa|detektywi|detektyw)'];
    const text = 'Usługi detektywistyczne świadczy detektyw z licencją.';

    expect(countOccurrences(text, 'detektyw', rx)).toBe(1);
    // The fuzzy path counts "detektywistyczne" as "detektyw" — the bug regexps fix.
    expect(countOccurrences(text, 'detektyw')).toBe(2);
  });

  /**
   * A hyphenated term arrives as one alternation per word — the sidecar splits it the
   * same way the scorer tokenizes ("e-mail" → two words), so the two regexps line up
   * with the two tokens "e-maila" produces. The previous whitespace split left one
   * regexp facing two tokens and never matched.
   */
  it('matches a hyphenated term across the tokens it splits into', () => {
    const rx = ['(?:e)', '(?:mail|maila)'];
    const text = 'Zabezpiecz e-maila przed usunięciem.';

    expect(countOccurrences(text, 'e-mail', rx)).toBe(1);
  });

  /** A pattern carrying a Python-escaped hyphen compiles (no `u` flag), not silently dropped. */
  it('compiles a regexp containing a re.escape hyphen instead of failing to fuzzy', () => {
    const rx = ['(?:pod\\-sluch|pod\\-sluchu)'];
    const text = 'Wykryto pod-sluch w aucie.';

    expect(countOccurrences(text, 'pod-sluch', rx)).toBe(0); // hyphen splits the token → no single-token match
    expect(() => countOccurrences(text, 'pod-sluch', rx)).not.toThrow();
  });

  it('falls back to fuzzy matching when a regexp is malformed', () => {
    const text = 'Prywatny detektyw prowadzi obserwację.';

    expect(countOccurrences(text, 'detektyw', ['(?:unclosed'])).toBe(1);
  });
});

describe('filterUsefulNlpTerms lemma dedupe', () => {
  it('folds inflection variants sharing a lemma_key into one term', () => {
    const terms: NlpTerm[] = [
      { term: 'licencjonowany detektyw', target_count: 3, salience: 40, lemma_key: 'licencjonowan detektyw' },
      { term: 'licencjonowani detektywi', target_count: 3, salience: 31, lemma_key: 'licencjonowan detektyw' },
      { term: 'wykrywanie podsłuchów', target_count: 2, salience: 50, lemma_key: 'wykrywani podsluch' },
    ];

    const out = filterUsefulNlpTerms(terms);

    expect(out).toHaveLength(2);
    expect(out.map((t) => t.lemma_key).sort()).toEqual(['licencjonowan detektyw', 'wykrywani podsluch']);
    // Which variant survives matters and cardinality alone cannot see it: the tiebreak
    // prefers the diacritics-bearing form, then the longer one, so 'licencjonowani
    // detektywi' must win. Asserting only the count let a survivor regression through.
    expect(out.map((t) => t.term).sort()).toEqual(['licencjonowani detektywi', 'wykrywanie podsłuchów']);
  });

  it('keeps distinct terms distinct without lemma keys', () => {
    const terms: NlpTerm[] = [
      { term: 'agencja detektywistyczna', target_count: 3, salience: 60 },
      { term: 'biuro detektywistyczne', target_count: 2, salience: 50 },
    ];

    expect(filterUsefulNlpTerms(terms)).toHaveLength(2);
  });
});
