// Comments API no longer fan-outs via Ably — create still persists the thread.
jest.mock('../../lib/commentAccess', () => ({
  getCommentAccessKind: jest.fn().mockResolvedValue('owner'),
  isOwnerComment: jest.fn().mockResolvedValue(false),
}));
jest.mock('../../database/database', () => ({
  __esModule: true,
  default: { sync: jest.fn().mockResolvedValue(undefined), query: jest.fn().mockResolvedValue([[], {}]) },
}));
jest.mock('../../lib/ensureArticlesTables', () => ({ ensureArticlesTables: jest.fn().mockResolvedValue(undefined) }));

import handler from '../../pages/api/articles/[id]/comments';

function mockRes() {
  const res: { statusCode: number; body?: unknown; status: (c: number) => typeof res; json: (b: unknown) => typeof res } = {
    statusCode: 200,
    status(c: number) { this.statusCode = c; return this; },
    json(b: unknown) { this.body = b; return this; },
  };
  return res;
}

it('creates a comment thread without Ably fan-out', async () => {
  const res = mockRes();
  await handler(
    {
      method: 'POST',
      query: { id: '9' },
      headers: {},
      body: { quote: 'q', text: 'hello', author: 'Joe', color: '#F84416' },
    } as Parameters<typeof handler>[0],
    res as Parameters<typeof handler>[1],
  );
  expect(res.statusCode).toBe(200);
});
