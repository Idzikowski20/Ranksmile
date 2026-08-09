/** @jest-environment node */
import { naiveTimestampAlterSql } from '../../lib/ensureUtcTimestamps';

type QueryOpts = { transaction?: unknown };

const query = jest.fn();
const getDialect = jest.fn(() => 'postgres');
const transaction = jest.fn(async (cb: (t: unknown) => Promise<unknown>) => cb('TX'));

jest.mock('../../database/database', () => ({
  __esModule: true,
  default: {
    query: (...args: unknown[]) => query(...args),
    getDialect: () => getDialect(),
    transaction: (cb: (t: unknown) => Promise<unknown>) => transaction(cb),
  },
}));

// Fresh module per test — the helper memoises its first run on purpose.
async function loadEnsure() {
  let mod!: typeof import('../../lib/ensureUtcTimestamps');
  await jest.isolateModulesAsync(async () => {
    mod = await import('../../lib/ensureUtcTimestamps');
  });
  return mod;
}

/** Only the schema changes — ignores the lookup and the lock_timeout statements. */
function alterStatements(): string[] {
  return query.mock.calls.map((c) => String(c[0])).filter((s) => s.includes('ALTER TABLE'));
}

function lookupCount(): number {
  return query.mock.calls.filter((c) => String(c[0]).includes('information_schema')).length;
}

beforeEach(() => {
  query.mockReset();
  getDialect.mockReset().mockReturnValue('postgres');
  transaction.mockClear();
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

    const { ensureUtcTimestamps } = await loadEnsure();
    await expect(ensureUtcTimestamps()).resolves.toBe(2);

    expect(alterStatements()).toEqual([
      expect.stringContaining('"organizations" ALTER COLUMN "trial_ends_at" TYPE TIMESTAMPTZ'),
      expect.stringContaining('"articles" ALTER COLUMN "published_at" TYPE TIMESTAMPTZ'),
    ]);
  });

  // SET LOCAL only binds to the connection running the transaction. Issued as a
  // bare pooled query it could cap nothing and leak onto an unrelated request.
  it('caps the lock wait inside the same transaction as its ALTER', async () => {
    query.mockResolvedValueOnce([
      { table_name: 'articles', column_name: 'published_at' },
      { table_name: 'domains', column_name: 'created_at' },
    ]).mockResolvedValue([]);

    const { ensureUtcTimestamps } = await loadEnsure();
    await ensureUtcTimestamps();

    // One transaction per column, so a lock is never held across two rewrites.
    expect(transaction).toHaveBeenCalledTimes(2);

    const scoped = query.mock.calls
      .filter((c) => String(c[0]).includes('lock_timeout') || String(c[0]).includes('ALTER TABLE'));
    expect(scoped).toHaveLength(4);
    for (const [sql, opts] of scoped) {
      expect((opts as QueryOpts)?.transaction).toBe('TX');
      expect(String(sql)).not.toMatch(/^SET lock_timeout/); // must be SET LOCAL
    }
    expect(String(scoped[0][0])).toBe("SET LOCAL lock_timeout = '3s'");
  });

  it('is a no-op once nothing is naive any more', async () => {
    query.mockResolvedValue([]);
    const { ensureUtcTimestamps } = await loadEnsure();
    await expect(ensureUtcTimestamps()).resolves.toBe(0);
    expect(alterStatements()).toEqual([]);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('skips sqlite, which has no TIMESTAMPTZ', async () => {
    getDialect.mockReturnValue('sqlite');
    const { ensureUtcTimestamps } = await loadEnsure();
    await expect(ensureUtcTimestamps()).resolves.toBe(0);
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

    const { ensureUtcTimestamps } = await loadEnsure();
    await expect(ensureUtcTimestamps()).resolves.toBe(1);
    expect(alterStatements()).toHaveLength(2); // both attempted
  });

  it('runs once per process — a second call reuses the first result', async () => {
    query.mockResolvedValueOnce([{ table_name: 'articles', column_name: 'published_at' }])
      .mockResolvedValue([]);

    const { ensureUtcTimestamps } = await loadEnsure();
    const [a, b] = await Promise.all([ensureUtcTimestamps(), ensureUtcTimestamps()]);

    expect([a, b]).toEqual([1, 1]);
    expect(lookupCount()).toBe(1);
    expect(alterStatements()).toHaveLength(1);
  });

  it('retries on the next call when the run threw', async () => {
    query.mockRejectedValueOnce(new Error('connection reset'))
      .mockResolvedValueOnce([{ table_name: 'articles', column_name: 'published_at' }])
      .mockResolvedValue([]);

    const { ensureUtcTimestamps } = await loadEnsure();
    await expect(ensureUtcTimestamps()).rejects.toThrow('connection reset');

    // A failed run must not be memoised, or the repair never happens again.
    await expect(ensureUtcTimestamps()).resolves.toBe(1);
    expect(lookupCount()).toBe(2);
  });
});
