jest.mock('../../database/database', () => ({
  __esModule: true,
  default: { query: jest.fn() },
}));
jest.mock('../../lib/ensureTenancyTables', () => ({
  ensureTenancyTables: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../lib/articleSql', () => ({ getArticleIdSql: jest.fn().mockResolvedValue('id') }));

import db from '../../database/database';
import { articleIdForShareToken } from '../../lib/tenancy';

const mockQuery = db.query as jest.Mock;
const rows = (r: unknown[]) => [r, {}];

describe('articleIdForShareToken', () => {
  beforeEach(() => mockQuery.mockReset());

  it('resolves a valid token to its article id', async () => {
    mockQuery.mockResolvedValueOnce(rows([{ id: 42 }]));
    expect(await articleIdForShareToken('tok_valid')).toBe(42);
    const sql = String(mockQuery.mock.calls[0][0]);
    expect(sql).toContain('share_token = ?');
  });

  it('returns null when the token matches no article', async () => {
    mockQuery.mockResolvedValueOnce(rows([]));
    expect(await articleIdForShareToken('tok_unknown')).toBeNull();
  });

  it('returns null for a falsy token without querying', async () => {
    expect(await articleIdForShareToken('')).toBeNull();
    expect(await articleIdForShareToken(undefined)).toBeNull();
    expect(mockQuery).not.toHaveBeenCalled();
  });
});
