/** @jest-environment node */
const query = jest.fn();
const getBrandDnaSummary = jest.fn();
const onboardBrandDna = jest.fn();

jest.mock('../../database/database', () => ({
  __esModule: true,
  default: { query: (...a: unknown[]) => query(...a) },
}));
jest.mock('../../lib/wie/brandDnaOnboarding', () => ({
  __esModule: true,
  getBrandDnaSummary: () => getBrandDnaSummary(),
  onboardBrandDna: (...a: unknown[]) => onboardBrandDna(...a),
}));

// eslint-disable-next-line import/first
import { autoLearnBrandDna } from '../../lib/wie/autoLearnBrandDna';

const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();

beforeEach(() => {
  query.mockReset();
  getBrandDnaSummary.mockReset();
  onboardBrandDna.mockReset().mockResolvedValue({ patternsAdded: 7 });
});

describe('autoLearnBrandDna', () => {
  it('learns from the domain\'s best audited pages when the DNA is stale', async () => {
    getBrandDnaSummary.mockResolvedValue({ updated_at: daysAgo(30) });
    query.mockResolvedValue([
      { url: 'https://site.pl/a' }, { url: 'https://site.pl/b' }, { url: 'https://site.pl/c' },
    ]);

    await expect(autoLearnBrandDna({ domainId: 2, keyword: 'detektyw' }))
      .resolves.toEqual({ learned: true, reason: '+7 pattern(s)', urls: 3 });

    expect(onboardBrandDna).toHaveBeenCalledWith({
      urls: ['https://site.pl/a', 'https://site.pl/b', 'https://site.pl/c'],
      keyword: 'detektyw',
    });
  });

  // The whole pass silently no-opped in production for exactly this reason: it read
  // domain_gsc_pages, which ensurePipelineTables creates and truncates but nothing ever
  // inserts into. Mocking the query hid it, so pin the table the SQL actually names.
  it('reads page_audits, which is populated, not domain_gsc_pages, which never is', async () => {
    getBrandDnaSummary.mockResolvedValue(null);
    query.mockResolvedValue([{ url: 'https://site.pl/a' }, { url: 'https://site.pl/b' }]);

    await autoLearnBrandDna({ domainId: 2 });

    const sql = String(query.mock.calls[0][0]);
    expect(sql).toMatch(/FROM page_audits/);
    expect(sql).not.toMatch(/domain_gsc_pages/);
  });

  // Which eight pages get learned from is the whole behaviour, so the ranking is
  // pinned: best score first, and url ASC last so tied pages cannot be cut in a
  // different order on two runs over the same data.
  it('ranks by score and breaks ties deterministically', async () => {
    getBrandDnaSummary.mockResolvedValue(null);
    query.mockResolvedValue([{ url: 'https://site.pl/a' }, { url: 'https://site.pl/b' }]);

    await autoLearnBrandDna({ domainId: 2 });

    // NULLS LAST rather than COALESCE(score, 0): same order for a 0..100 score, but an
    // expression the planner cannot match keeps idx_page_audits_best off the sort.
    expect(String(query.mock.calls[0][0])).toMatch(/ORDER BY score DESC NULLS LAST.*url ASC/s);
  });

  // Re-learning on every analysis would hammer the ingest for no gain.
  it('does nothing while the DNA is recent', async () => {
    getBrandDnaSummary.mockResolvedValue({ updated_at: daysAgo(3) });

    const r = await autoLearnBrandDna({ domainId: 2 });

    expect(r.learned).toBe(false);
    expect(onboardBrandDna).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });

  it('learns for the first time when there is no DNA at all', async () => {
    getBrandDnaSummary.mockResolvedValue(null);
    query.mockResolvedValue([{ url: 'https://site.pl/a' }, { url: 'https://site.pl/b' }]);

    await expect(autoLearnBrandDna({ domainId: 2 })).resolves.toMatchObject({ learned: true });
  });

  // One article's habits are not a voice.
  it('holds off below two audited pages', async () => {
    getBrandDnaSummary.mockResolvedValue(null);
    query.mockResolvedValue([{ url: 'https://site.pl/only' }]);

    const r = await autoLearnBrandDna({ domainId: 2 });

    expect(r).toEqual({ learned: false, reason: 'only 1 audited page(s)', urls: 1 });
    expect(onboardBrandDna).not.toHaveBeenCalled();
  });

  // It runs beside an analysis; a failure here must never surface as one.
  it('swallows a failing ingest', async () => {
    getBrandDnaSummary.mockResolvedValue(null);
    query.mockResolvedValue([{ url: 'https://site.pl/a' }, { url: 'https://site.pl/b' }]);
    onboardBrandDna.mockRejectedValue(new Error('scrape blocked'));

    await expect(autoLearnBrandDna({ domainId: 2 }))
      .resolves.toEqual({ learned: false, reason: 'failed: scrape blocked', urls: 0 });
  });
});
