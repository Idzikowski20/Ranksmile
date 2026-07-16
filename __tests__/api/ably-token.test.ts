jest.mock('../../lib/commentAccess', () => ({ getCommentAccessKind: jest.fn() }));
jest.mock('../../lib/ably/server', () => ({
  mintArticleToken: jest.fn(),
  isAblyConfigured: jest.fn(() => true),
}));

import handler from '../../pages/api/ably-token';
import { getCommentAccessKind } from '../../lib/commentAccess';
import { mintArticleToken } from '../../lib/ably/server';

function mockRes() {
  const res: any = {};
  res.statusCode = 200;
  res.status = (c: number) => { res.statusCode = c; return res; };
  res.json = (b: any) => { res.body = b; return res; };
  res.setHeader = () => res;
  return res;
}

describe('GET /api/ably-token', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects a missing/invalid articleId with 400', async () => {
    const res = mockRes();
    await handler({ method: 'GET', query: {} } as any, res);
    expect(res.statusCode).toBe(400);
  });

  it('403s when the caller has no access', async () => {
    (getCommentAccessKind as jest.Mock).mockResolvedValue(null);
    const res = mockRes();
    await handler({ method: 'GET', query: { articleId: '5' } } as any, res);
    expect(res.statusCode).toBe(403);
  });

  it('mints an owner token with an owner clientId', async () => {
    (getCommentAccessKind as jest.Mock).mockResolvedValue('owner');
    (mintArticleToken as jest.Mock).mockResolvedValue({ keyName: 'k', mac: 'm' });
    const res = mockRes();
    await handler({ method: 'GET', query: { articleId: '5' } } as any, res);
    expect(mintArticleToken).toHaveBeenCalledWith(
      expect.objectContaining({ articleId: 5, kind: 'owner' }),
    );
    expect((mintArticleToken as jest.Mock).mock.calls[0][0].clientId).toMatch(/^owner:/);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ keyName: 'k', mac: 'm' });
  });

  it('mints a viewer token with a sanitized guest clientId', async () => {
    (getCommentAccessKind as jest.Mock).mockResolvedValue('token');
    (mintArticleToken as jest.Mock).mockResolvedValue({ keyName: 'k', mac: 'm' });
    const res = mockRes();
    await handler({ method: 'GET', query: { articleId: '5', token: 'abc', clientId: 'Joe <x>' } } as any, res);
    const arg = (mintArticleToken as jest.Mock).mock.calls[0][0];
    expect(arg.kind).toBe('token');
    expect(arg.clientId).toBe('guest:Joe x'); // angle brackets stripped
  });
});
