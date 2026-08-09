/** @jest-environment node */
import { naiveTimestampAlterSql } from '../../lib/ensureUtcTimestamps';

const query = jest.fn();
const getDialect = jest.fn(() => 'postgres');

jest.mock('../../database/database', () => ({
  __esModule: true,
  default: {
    query: (...args: unknown[]) => query(...args),
    getDialect: () => getDialect(),
  },
}));

// Fresh module per test — the helper memoises its first run on purpose.
async function loadEnsure() {
  let mod!: typeof import('../../lib/ensureUtcTimestamps');
  await jest.isolateModulesAsync(async () => {
    mod = await import('../../lib/ensureUtcTimestamps');
  });
  return mod.ensureUtcTimestamps;
}

/** Only the schema changes — ignores the lookup and the lock_timeout bookends. */
function alterStatements(): string[] {
  return query.mock.calls.map((c) => String(c[0])).filter((s) => s.includes('ALTER TABLE'));
}

beforeEach(() => {
  query.mockReset();
  getDialect.mockReset().mockReturnValue('postgres');
});

describe('naiveTimestampAlterSql', () => {
  it('reinterprets the stored digits as UTC rather than shifting them', () => {
    expect(naiveTimestampAlterSql('organizations', 'trial_ends_at')).toBe(
      'ALTER TABLE "organizations" ALTER COLUMN "trial_ends_at" TYPE TIMESTAMPTZ'
      + ' USING "trial_ends_at" AT TIME ZONE \'UTC\'',
    );
  });

  it('quotes identifiers so a table name cannot break out of the statement', () => {
    expect(naiveTimestampAlterSql('we"ird', 'c"ol')).toContain('"we""ird"');
    expect(naiveTimestampAlterSql('we"ird', 'c"ol')).toContain('"c""ol"');
  });
});

describe('ensureUtcTimestamps', () => {
  it('converts every naive column it finds', async () => {
    query.mockResolvedValueOnce([
      { table_name: 'organizations', column_name: 'trial_ends_at' },
      { table_name: 'articles', column_name: 'published_at' },
    ]).mockResolvedValue([]);

    const ensure = await loadEnsure();
    await expect(ensure()).resolves.toBe(2);

    expect(alterStatements()).toEqual([
      expect.stringContaining('"organizations" ALTER COLUMN "trial_ends_at" TYPE TIMESTAMPTZ'),
      expect.stringContaining('"articles" ALTER COLUMN "published_at" TYPE TIMESTAMPTZ'),
    ]);
  });

  it('caps how long an ALTER may wait for its lock, then restores the session', async () => {
    query.mockResolvedValueOnce([{ table_name: 'articles', column_name: 'published_at' }])
      .mockResolvedValue([]);

    const ensure = await loadEnsure();
    await ensure();

    const sql = query.mock.calls.map((c) => String(c[0]));
    expect(sql).toContain("SET lock_timeout = '3s'");
    expect(sql).toContain('SET lock_timeout = DEFAULT');
    // The cap has to be in place before the first ALTER, not after it.
    expect(sql.indexOf("SET lock_timeout = '3s'")).toBeLessThan(sql.findIndex((s) => s.includes('ALTER TABLE')));
  });

  it('is a no-op once nothing is naive any more', async () => {
    query.mockResolvedValue([]);
    const ensure = await loadEnsure();
    await expect(ensure()).resolves.toBe(0);
    expect(query).toHaveBeenCalledTimes(1); // the lookup, no ALTERs
    expect(alterStatements()).toEqual([]);
  });

  it('skips sqlite, which has no TIMESTAMPTZ', async () => {
    getDialect.mockReturnValue('sqlite');
    const ensure = await loadEnsure();
    await expect(ensure()).resolves.toBe(0);
    expect(query).not.toHaveBeenCalled();
  });

  // Real case: rank_snapshots_* is partitioned on checked_at, and Postgres
  // refuses to retype a partition-key column. The rest must still convert.
  it('keeps going when one column cannot be altered', async () => {
    query.mockImplementation((sql: string) => {
      if (String(sql).includes('information_schema')) {
        return Promise.resolve([
          { table_name: 'locked', column_name: 'at' },
          { table_name: 'fine', column_name: 'at' },
        ]);
      }
      if (String(sql).includes('"locked"')) {
        return Promise.reject(new Error('cannot alter column "at" because it is part of the partition key'));
      }
      return Promise.resolve([]);
    });

    const ensure = await loadEnsure();
    await expect(ensure()).resolves.toBe(1);
    expect(alterStatements()).toHaveLength(2); // both attempted
  });
});
