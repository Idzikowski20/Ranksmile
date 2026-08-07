jest.mock('../../database/database', () => ({ __esModule: true, default: { query: jest.fn() } }));

const rows = (r: unknown[]) => [r, {}];

/**
 * `onboardingState` caches "table checked" in module scope, so a second test would skip
 * the DDL and shift every mocked response by two. Re-import per test to get a fresh
 * cache and a fresh db mock.
 */
async function load() {
  jest.resetModules();
  const dbModule = await import('../../database/database');
  const query = dbModule.default.query as jest.Mock;
  query.mockReset();
  // CREATE TABLE, then the tour_seen_at ALTER migration.
  query.mockResolvedValueOnce(rows([])).mockResolvedValueOnce(rows([]));
  const state = await import('../../lib/onboardingState');
  return { query, ...state };
}

/** SQL of the nth call, counting from the first statement after the DDL. */
const stmt = (query: jest.Mock, n: number) => String(query.mock.calls[2 + n][0]);

describe('page tour state', () => {
  it('reports unseen when the user has no onboarding row at all', async () => {
    const { query, isPageTourSeen } = await load();
    query.mockResolvedValueOnce(rows([]));
    await expect(isPageTourSeen('u1')).resolves.toBe(false);
  });

  it('reports unseen when the row exists but the tour was never dismissed', async () => {
    const { query, isPageTourSeen } = await load();
    query.mockResolvedValueOnce(rows([{ tour_seen_at: null }]));
    await expect(isPageTourSeen('u1')).resolves.toBe(false);
  });

  it('reports seen once a timestamp is recorded', async () => {
    const { query, isPageTourSeen } = await load();
    query.mockResolvedValueOnce(rows([{ tour_seen_at: '2026-08-07 09:00:00' }]));
    await expect(isPageTourSeen('u1')).resolves.toBe(true);
  });

  it('inserts a row for a user who finished the tour before the survey', async () => {
    const { query, markPageTourSeen } = await load();
    query.mockResolvedValueOnce(rows([]));
    await markPageTourSeen('u1');
    expect(stmt(query, 0)).toContain('INSERT INTO user_onboarding');
    expect(stmt(query, 0)).toContain('tour_seen_at');
  });

  /**
   * Two tabs finishing at once both reach the insert; the loser hits the user_id
   * primary key. That must fall through to an UPDATE, not surface as a 500.
   */
  it('falls back to UPDATE when the user already has a row', async () => {
    const { query, markPageTourSeen } = await load();
    query.mockRejectedValueOnce(Object.assign(new Error('dup'), { name: 'SequelizeUniqueConstraintError' }));
    query.mockResolvedValueOnce(rows([]));
    await markPageTourSeen('u1');
    expect(stmt(query, 1)).toContain('UPDATE user_onboarding');
    expect(stmt(query, 1)).toContain('tour_seen_at');
  });

  it('rethrows failures that are not a duplicate row', async () => {
    const { query, markPageTourSeen } = await load();
    query.mockRejectedValueOnce(new Error('connection lost'));
    await expect(markPageTourSeen('u1')).rejects.toThrow('connection lost');
  });

  /** The migration re-runs on every cold start; a duplicate-column error is expected. */
  it('survives the ALTER failing because the column already exists', async () => {
    jest.resetModules();
    const dbModule = await import('../../database/database');
    const query = dbModule.default.query as jest.Mock;
    query.mockReset();
    query.mockResolvedValueOnce(rows([]));
    query.mockRejectedValueOnce(new Error('duplicate column name: tour_seen_at'));
    const { isPageTourSeen } = await import('../../lib/onboardingState');
    query.mockResolvedValueOnce(rows([]));
    await expect(isPageTourSeen('u1')).resolves.toBe(false);
  });
});
