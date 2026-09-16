import db from '@/database/database';
import { getLatestSiteSpeed, measureDomainSiteSpeed } from '@/src/infrastructure/siteAudit/siteSpeed';

jest.mock('sequelize', () => ({ QueryTypes: { SELECT: 'SELECT' } }));
jest.mock('@/database/database', () => ({ __esModule: true, default: { query: jest.fn() } }));

const mockQuery = db.query as jest.Mock;

/** Return the measurement row for the SELECT; anything else (DDL) resolves empty. */
function withMeasuredAt(measuredAt: string | Date) {
  mockQuery.mockImplementation((sql: string) => {
    if (String(sql).includes('SELECT url')) {
      return Promise.resolve([{
        url: 'https://x.pl', score: 87, lcp_ms: 2540, tbt_ms: 885, cls: 0.004,
        speed_index_ms: 2540, measured_at: measuredAt,
      }]);
    }
    return Promise.resolve([]);
  });
}

beforeEach(() => mockQuery.mockReset());

describe('getLatestSiteSpeed measuredAt', () => {
  it('reads an offset-less SQLite timestamp (CURRENT_TIMESTAMP) as UTC', async () => {
    withMeasuredAt('2026-09-16 10:00:00');
    expect((await getLatestSiteSpeed(1))?.measuredAt).toBe('2026-09-16T10:00:00.000Z');
  });

  it('honours an explicit offset', async () => {
    withMeasuredAt('2026-09-16T12:00:00+02:00');
    expect((await getLatestSiteSpeed(1))?.measuredAt).toBe('2026-09-16T10:00:00.000Z');
  });

  it('keeps an already-UTC (Z) timestamp', async () => {
    withMeasuredAt('2026-09-16T10:00:00Z');
    expect((await getLatestSiteSpeed(1))?.measuredAt).toBe('2026-09-16T10:00:00.000Z');
  });

  it('serialises a Date value (Postgres) as UTC', async () => {
    withMeasuredAt(new Date('2026-09-16T10:00:00Z'));
    expect((await getLatestSiteSpeed(1))?.measuredAt).toBe('2026-09-16T10:00:00.000Z');
  });

  it('returns null when there is no measurement', async () => {
    mockQuery.mockResolvedValue([]);
    expect(await getLatestSiteSpeed(1)).toBeNull();
  });
});

describe('measureDomainSiteSpeed', () => {
  const origFetch = global.fetch;
  const origKey = process.env.PAGESPEED_API_KEY;
  afterEach(() => { global.fetch = origFetch; process.env.PAGESPEED_API_KEY = origKey; });

  it('is a no-op when PageSpeed is not configured', async () => {
    delete process.env.PAGESPEED_API_KEY;
    global.fetch = jest.fn();
    await measureDomainSiteSpeed(3);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('is a no-op when the domain has no host', async () => {
    process.env.PAGESPEED_API_KEY = 'k';
    global.fetch = jest.fn();
    mockQuery.mockResolvedValue([{ domain: null }]); // domain lookup → no host
    await measureDomainSiteSpeed(3);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('resolves the host to https and measures it', async () => {
    process.env.PAGESPEED_API_KEY = 'k';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ lighthouseResult: { categories: { performance: { score: 0.5 } }, audits: {} } }),
    });
    mockQuery.mockImplementation((sql: string) => {
      if (String(sql).includes('SELECT domain FROM domain')) return Promise.resolve([{ domain: 'idztech.pl' }]);
      return Promise.resolve([]); // DDL + INSERT
    });
    await measureDomainSiteSpeed(3);
    const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(calledUrl).toContain('url=https%3A%2F%2Fidztech.pl');
    expect(mockQuery.mock.calls.some((c) => String(c[0]).includes('INSERT INTO site_speed_measurements'))).toBe(true);
  });
});
