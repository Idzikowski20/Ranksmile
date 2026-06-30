// Mock the ably module so no network happens.
const publishMock = jest.fn().mockResolvedValue(undefined);
const getMock = jest.fn(() => ({ publish: publishMock }));
const createTokenRequestMock = jest.fn().mockResolvedValue({ keyName: 'k', mac: 'm' });

jest.mock('ably', () => ({
  Rest: jest.fn().mockImplementation(() => ({
    channels: { get: getMock },
    auth: { createTokenRequest: createTokenRequestMock },
  })),
}));

describe('lib/ably/server', () => {
  const OLD_ENV = process.env;
  beforeEach(() => {
    jest.resetModules();
    publishMock.mockClear();
    getMock.mockClear();
    process.env = { ...OLD_ENV, ABLY_API_KEY: 'app.key:secret' };
  });
  afterAll(() => { process.env = OLD_ENV; });

  it('publishes to the article channel with the right event name', async () => {
    const { publishToArticle } = require('../../lib/ably/server');
    await publishToArticle(7, 'comment', { type: 'create', commentId: 'c_1' });
    expect(getMock).toHaveBeenCalledWith('article:7');
    expect(publishMock).toHaveBeenCalledWith('comment', { type: 'create', commentId: 'c_1' });
  });

  it('swallows publish errors (never throws into the caller)', async () => {
    publishMock.mockRejectedValueOnce(new Error('ably down'));
    const { publishToArticle } = require('../../lib/ably/server');
    await expect(publishToArticle(7, 'content', { html: 'x' })).resolves.toBeUndefined();
  });

  it('no-ops (no throw) when ABLY_API_KEY is unset', async () => {
    process.env = { ...OLD_ENV };
    delete process.env.ABLY_API_KEY;
    const { publishToArticle } = require('../../lib/ably/server');
    await expect(publishToArticle(7, 'content', { html: 'x' })).resolves.toBeUndefined();
    expect(publishMock).not.toHaveBeenCalled();
  });

  it('mints a capability-scoped token request', async () => {
    const { mintArticleToken } = require('../../lib/ably/server');
    await mintArticleToken({ articleId: 7, kind: 'owner', clientId: 'owner:u1' });
    expect(createTokenRequestMock).toHaveBeenCalledWith(expect.objectContaining({
      clientId: 'owner:u1',
      capability: JSON.stringify({ 'article:7': ['publish', 'subscribe', 'presence'] }),
    }));
  });
});
