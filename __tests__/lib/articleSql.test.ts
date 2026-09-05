/**
 * A transient DB failure (Postgres still booting, a blip) must not pin the wrong
 * article id column for the rest of the process — that turned every article query
 * into `column "ID" does not exist` until the dev server was restarted.
 */
const query = jest.fn();

jest.mock('@/database/database', () => ({ __esModule: true, default: { query: (...a: unknown[]) => query(...a) } }));

async function load() {
  let mod!: typeof import('@/src/infrastructure/articles/articleSql');
  jest.isolateModules(() => {
    process.env.DATABASE_URL = 'postgresql://x:y@127.0.0.1:5432/z';
    // eslint-disable-next-line global-require
    mod = require('@/src/infrastructure/articles/articleSql');
  });
  return mod;
}

describe('getArticleIdColumn', () => {
  beforeEach(() => { query.mockReset(); });

  it('retries detection after a failed lookup instead of caching the fallback', async () => {
    const { getArticleIdColumn } = await load();
    query.mockRejectedValueOnce(new Error('connect ECONNREFUSED 127.0.0.1:5432'));
    await getArticleIdColumn();
    query.mockResolvedValueOnce([{ column_name: 'id' }]);
    expect(await getArticleIdColumn()).toBe('id');
    expect(query).toHaveBeenCalledTimes(2);
  });

  it('caches a successful detection', async () => {
    const { getArticleIdColumn } = await load();
    query.mockResolvedValueOnce([{ column_name: 'id' }]);
    expect(await getArticleIdColumn()).toBe('id');
    expect(await getArticleIdColumn()).toBe('id');
    expect(query).toHaveBeenCalledTimes(1);
  });
});
