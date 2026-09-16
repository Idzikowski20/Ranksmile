jest.mock('sequelize', () => ({ QueryTypes: { SELECT: 'SELECT' } }));
jest.mock('@/database/database', () => ({ __esModule: true, default: { query: jest.fn() } }));

import db from '@/database/database';
import { getLatestSiteSpeed } from '@/src/infrastructure/siteAudit/siteSpeed';

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
