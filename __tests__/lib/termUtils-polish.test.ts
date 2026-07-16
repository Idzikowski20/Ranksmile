import { normalizeTerm, dedupeUsefulTerms, isUsefulTerm } from '../../lib/termUtils';
import { filterUsefulNlpTerms } from '../../lib/competitorTermCalibration';

describe('normalizeTerm Polish diacritics', () => {
  it('maps ł to l instead of deleting it into a space', () => {
    expect(normalizeTerm('działania')).toBe('dzialania');
    expect(normalizeTerm('przykłady')).toBe('przyklady');
    expect(normalizeTerm('działania poniżej progu wojny')).toBe('dzialania ponizej progu wojny');
  });

  it('does not produce dzia ania from działania', () => {
    expect(normalizeTerm('działania')).not.toMatch(/dzia ania/);
  });
});

describe('dedupeUsefulTerms display ≠ match', () => {
  it('keeps Polish orthography on the displayed term', () => {
    const out = dedupeUsefulTerms([
      { term: 'działania hybrydowe' },
      { term: 'dzialania hybrydowe' },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].term).toBe('działania hybrydowe');
  });
});

describe('filterUsefulNlpTerms display ≠ match', () => {
  it('does not overwrite term with ASCII-folded form', () => {
    const out = filterUsefulNlpTerms([
      {
        term: 'działania poniżej progu wojny',
        target_count: 2,
        suggested_min: 1,
        suggested_max: 3,
      },
    ]);
    expect(out[0].term).toBe('działania poniżej progu wojny');
    expect(isUsefulTerm(out[0].term)).toBe(true);
  });
});
