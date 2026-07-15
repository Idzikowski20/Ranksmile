// Verify the comments handler publishes a 'comment' event after a create.
jest.mock('../../lib/ably/server', () => ({ publishToArticle: jest.fn().mockResolvedValue(undefined) }));
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
import { publishToArticle } from '../../lib/ably/server';

function mockRes() {
  const res: any = { statusCode: 200 };
  res.status = (c: number) => { res.statusCode = c; return res; };
  res.json = (b: any) => { res.body = b; return res; };
  return res;
}

it('publishes a comment:create event to Ably after a successful POST', async () => {
  const res = mockRes();
  await handler({
    method: 'POST', query: { id: '9' },
    body: { quote: 'q', text: 'hello', author: 'Joe', color: '#F29964' },
  } as any, res);
  expect(res.statusCode).toBe(200);
  expect(publishToArticle).toHaveBeenCalledWith('9', 'comment', expect.objectContaining({ type: 'create' }));
});
