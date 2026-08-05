jest.mock('../../lib/commentAccess', () => ({ assertCommentAccess: jest.fn(), getCommentAccessKind: jest.fn() }));
jest.mock('../../lib/ensureArticlesTables', () => ({ ensureArticlesTables: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../lib/commentBus', () => ({ emitCommentChange: jest.fn(), onCommentChange: jest.fn(() => () => {}) }));
jest.mock('../../database/database', () => ({ __esModule: true, default: { query: jest.fn(), sync: jest.fn().mockResolvedValue(undefined) } }));

import db from '../../database/database';
import { assertCommentAccess, getCommentAccessKind } from '../../lib/commentAccess';
import handler from '../../pages/api/articles/[id]/comments';
import streamHandler from '../../pages/api/articles/[id]/comments-stream';

const mockAccess = assertCommentAccess as jest.Mock;
const mockAccessKind = getCommentAccessKind as jest.Mock;
const mockQuery = db.query as jest.Mock;

const makeRes = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.end = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn();
  res.writeHead = jest.fn().mockReturnValue(res);
  res.write = jest.fn();
  return res;
};

beforeEach(() => { mockAccess.mockReset(); mockAccessKind.mockReset(); mockQuery.mockReset(); });

describe('comments endpoint authorization', () => {
  it('denies GET when owner access is not present', async () => {
    mockAccessKind.mockResolvedValue(null);
    const res = makeRes();
    await handler({ method: 'GET', query: { id: '123' }, headers: {}, cookies: {} } as any, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('denies POST (write) when access is not granted', async () => {
    mockAccessKind.mockResolvedValue(null);
    const res = makeRes();
    await handler({ method: 'POST', query: { id: '123' }, headers: {}, cookies: {}, body: { text: 'hi' } } as any, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('serves GET once owner access is granted', async () => {
    mockAccessKind.mockResolvedValue('owner');
    mockQuery.mockResolvedValueOnce([[], {}]);
    const res = makeRes();
    await handler({ method: 'GET', query: { id: '123' }, headers: {}, cookies: {} } as any, res);
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe('comments-stream endpoint authorization', () => {
  it('denies the SSE stream when access is not granted', async () => {
    mockAccess.mockResolvedValue(false);
    const res = makeRes();
    const req = { method: 'GET', query: { id: '123' }, headers: {}, cookies: {}, on: jest.fn() } as any;
    await streamHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.writeHead).not.toHaveBeenCalled();
  });
});
