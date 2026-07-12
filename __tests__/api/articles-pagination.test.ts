/** @jest-environment node */
import type { NextApiRequest, NextApiResponse } from 'next';

jest.mock('../../database/database', () => ({
  __esModule: true,
  default: { sync: jest.fn(), query: jest.fn() },
}));

jest.mock('../../utils/verifyUser', () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue('authorized'),
}));

jest.mock('../../utils/getUser', () => ({
  getCurrentUserId: jest.fn().mockResolvedValue('user-1'),
}));

jest.mock('../../lib/ensureArticlesTables', () => ({
  ensureArticlesTables: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../lib/tenancy', () => ({
  getAccessibleWorkspaceIds: jest.fn().mockResolvedValue([1]),
}));

jest.mock('../../database/models/domain', () => ({
  __esModule: true,
  default: {
    findAll: jest.fn().mockResolvedValue([{ ID: 1 }]),
    findOne: jest.fn(),
  },
}));

jest.mock('../../lib/articleSql', () => ({
  getArticleIdSql: jest.fn().mockResolvedValue('id'),
}));

import db from '../../database/database';
import handler from '../../pages/api/articles/index';

function mockReq(query: Record<string, string> = {}): NextApiRequest {
  return { method: 'GET', query } as NextApiRequest;
}

function mockRes() {
  const res: Partial<NextApiResponse> & { _status?: number; _json?: unknown } = {};
  res.status = jest.fn((code: number) => { res._status = code; return res as NextApiResponse; });
  res.json = jest.fn((body: unknown) => { res._json = body; return res as NextApiResponse; });
  return res as NextApiResponse & { _status?: number; _json?: unknown };
}

describe('GET /api/articles pagination', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (db.query as jest.Mock)
      .mockResolvedValueOnce([[{ total: 50 }], undefined])
      .mockResolvedValueOnce([[{ id: 1, title: 'A' }], undefined])
      .mockResolvedValueOnce([[], undefined]);
  });

  it('returns paginated shape with hasMore', async () => {
    const req = mockReq({ domainId: '1', limit: '10', offset: '0' });
    const res = mockRes();
    await handler(req, res);
    expect(res._status).toBe(200);
    expect(res._json).toMatchObject({
      articles: expect.any(Array),
      total: 50,
      hasMore: true,
      limit: 10,
      offset: 0,
    });
  });
});
