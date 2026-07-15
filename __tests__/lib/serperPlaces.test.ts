import { getSerperPlacesApiKeys } from '../../lib/local/serperPlaces';

describe('getSerperPlacesApiKeys', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('prefers SERPER_API_KEY before SCRAPER_API_KEY', () => {
    process.env.SERPER_API_KEY = 'serper-key';
    process.env.SCRAPER_API_KEY = 'scraper-key';

    expect(getSerperPlacesApiKeys()).toEqual(['serper-key', 'scraper-key']);
  });

  it('deduplicates identical keys', () => {
    process.env.SERPER_API_KEY = 'same-key';
    process.env.SCRAPER_API_KEY = 'same-key';

    expect(getSerperPlacesApiKeys()).toEqual(['same-key']);
  });

  it('returns empty list when no keys configured', () => {
    delete process.env.SERPER_API_KEY;
    delete process.env.SCRAPER_API_KEY;

    expect(getSerperPlacesApiKeys()).toEqual([]);
  });
});
