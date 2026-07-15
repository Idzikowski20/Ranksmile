import { langForCountry, countryForLang } from '../../lib/countryLang';

describe('countryLang', () => {
  it('maps country to language', () => {
    expect(langForCountry('PL')).toBe('pl');
    expect(langForCountry('US')).toBe('en');
    expect(langForCountry('XX')).toBe('en');
  });

  it('maps language to default country', () => {
    expect(countryForLang('pl')).toBe('PL');
    expect(countryForLang('en')).toBe('US');
    expect(countryForLang('de')).toBe('DE');
  });

  it('round-trips pl/PL', () => {
    expect(langForCountry(countryForLang('pl'))).toBe('pl');
  });
});
