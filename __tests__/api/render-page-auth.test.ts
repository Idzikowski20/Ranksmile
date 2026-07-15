jest.mock('../../utils/verifyUser', () => ({ __esModule: true, default: jest.fn().mockResolvedValue('unauthorized') }));
jest.mock('../../utils/spaScraper', () => ({ renderPage: jest.fn().mockResolvedValue({ html: '<html></html>', url: 'https://example.com' }) }));
jest.mock('../../lib/ssrfGuard', () => ({ assertPublicUrl: jest.fn().mockResolvedValue(undefined) }));

import handler from '../../pages/api/render-page';
import verifyUser from '../../utils/verifyUser';
import { renderPage } from '../../utils/spaScraper';
import { assertPublicUrl } from '../../lib/ssrfGuard';

const makeRes = () => {
  const res: { status: jest.Mock; json: jest.Mock } = {
    status: jest.fn(),
    json: jest.fn(),
  };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
};

const OLD_NODE_ENV = process.env.NODE_ENV;
const OLD_INTERNAL_PIPELINE_TOKEN = process.env.INTERNAL_PIPELINE_TOKEN;

beforeEach(() => {
  jest.clearAllMocks();
  process.env.NODE_ENV = 'production';
  delete process.env.INTERNAL_PIPELINE_TOKEN;
});

afterAll(() => {
  process.env.NODE_ENV = OLD_NODE_ENV;
  if (OLD_INTERNAL_PIPELINE_TOKEN === undefined) {
    delete process.env.INTERNAL_PIPELINE_TOKEN;
  } else {
    process.env.INTERNAL_PIPELINE_TOKEN = OLD_INTERNAL_PIPELINE_TOKEN;
  }
});

it('does not trust loopback remoteAddress as internal auth in production', async () => {
  const res = makeRes();

  await handler({
    method: 'POST',
    body: { url: 'https://example.com' },
    headers: {},
    socket: { remoteAddress: '127.0.0.1' },
  } as never, res as never);

  expect(verifyUser).toHaveBeenCalled();
  expect(res.status).toHaveBeenCalledWith(401);
  expect(assertPublicUrl).not.toHaveBeenCalled();
  expect(renderPage).not.toHaveBeenCalled();
});

it('accepts the shared internal token in production', async () => {
  process.env.INTERNAL_PIPELINE_TOKEN = 'secret-token';
  const res = makeRes();

  await handler({
    method: 'POST',
    body: { url: 'https://example.com' },
    headers: { 'x-internal-token': 'secret-token' },
    socket: { remoteAddress: '203.0.113.10' },
  } as never, res as never);

  expect(verifyUser).not.toHaveBeenCalled();
  expect(assertPublicUrl).toHaveBeenCalledWith('https://example.com');
  expect(renderPage).toHaveBeenCalledWith('https://example.com', 20_000);
  expect(res.status).toHaveBeenCalledWith(200);
});
