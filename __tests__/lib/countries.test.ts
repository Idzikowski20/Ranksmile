import countries, { countryAlphaTwoCodes, getCountryCodeFromAlphaThree } from '@/utils/countries';

describe('countries table', () => {
  it('resolves every alpha-three mapping to a real row', () => {
    const unresolved = Object.values(countryAlphaTwoCodes).filter((two) => !countries[two]);
    expect(unresolved).toEqual([]);
  });

  it('keeps the rows whose capital contained an apostrophe', () => {
    // These five used double-quoted capitals upstream and are easy to drop when reshaping the table.
    expect(countries.AG).toEqual(['Antigua and Barbuda', 'en', 2028]);
    expect(countries.GD).toEqual(['Grenada', 'en', 2308]);
    expect(countries.TD).toEqual(['Chad', 'fr', 2148]);
    expect(countries.TO).toEqual(['Tonga', 'en', 2776]);
    expect(countries.YE).toEqual(['Yemen', 'ar', 2887]);
  });

  it('gives every row a name, an hl language and a numeric geo id', () => {
    for (const [code, row] of Object.entries(countries)) {
      expect(row).toHaveLength(3);
      expect(typeof row[0]).toBe('string');
      expect(row[0].length).toBeGreaterThan(0);
      // AQ (Antarctica) carries an empty language upstream; everything else is an hl code.
      expect(row[1]).toMatch(/^([a-z]{2}(-[A-Za-z]+)?)?$/);
      expect(Number.isInteger(row[2])).toBe(true);
      expect(code).toMatch(/^[A-Z]{2}$/);
    }
  });

  it('maps alpha-three to alpha-two', () => {
    expect(getCountryCodeFromAlphaThree('USA')).toBe('US');
    expect(getCountryCodeFromAlphaThree('POL')).toBe('PL');
  });
});
