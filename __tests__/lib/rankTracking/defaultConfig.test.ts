import { defaultConfigFromCountry } from '../../../lib/rankTracking/defaultConfig';

describe('defaultConfigFromCountry', () => {
  it('maps PL to Polish locale', () => {
    const cfg = defaultConfigFromCountry('PL');
    expect(cfg.locationCode).toBe(2616);
    expect(cfg.languageCode).toBe('pl');
    expect(cfg.locationName).toBe('Poland');
  });

  it('falls back to US for unknown codes', () => {
    const cfg = defaultConfigFromCountry('XX');
    expect(cfg.locationCode).toBe(2840);
    expect(cfg.languageCode).toBe('en');
  });
});
