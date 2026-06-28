jest.mock('../../database/database', () => ({ __esModule: true, default: { query: jest.fn().mockResolvedValue([[], {}]) } }));
import db from '../../database/database';
import { ensureGscSnapshotTables } from '../../lib/ensureGscSnapshotTables';

const mockQuery = db.query as jest.Mock;

describe('ensureGscSnapshotTables', () => {
  beforeEach(() => mockQuery.mockClear());
  it('creates the snapshot table and adds the org throttle column', async () => {
    await ensureGscSnapshotTables();
    const sql = mockQuery.mock.calls.map((c: unknown[]) => String((c as unknown[])[0])).join('\n');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS gsc_page_snapshots');
    expect(sql).toContain('ALTER TABLE organizations ADD COLUMN last_gsc_digest_sent_at');
    expect(sql).toContain('idx_gsc_snap_domain_week');
  });
});
