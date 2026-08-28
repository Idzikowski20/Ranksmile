import verifyUser from '../../utils/verifyUser';
import { logLegacyApiKeyUse } from '@/src/infrastructure/legacyApiKeyLog';

jest.mock('@/src/infrastructure/legacyApiKeyLog', () => ({
  logLegacyApiKeyUse: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../utils/getUser', () => ({
  getCurrentUserId: jest.fn().mockResolvedValue(null),
  wasAuthUnavailable: jest.fn().mockReturnValue(false),
}));

import { getCurrentUserId, wasAuthUnavailable } from '../../utils/getUser';

const mockLog = logLegacyApiKeyUse as jest.MockedFunction<typeof logLegacyApiKeyUse>;
const mockUid = getCurrentUserId as jest.MockedFunction<typeof getCurrentUserId>;

const OLD_APIKEY = process.env.APIKEY;
const OLD_USER = process.env.USER;
const OLD_PASSWORD = process.env.PASSWORD;

beforeEach(() => {
  jest.clearAllMocks();
  process.env.APIKEY = 'test-api-key';
  process.env.USER = 'admin';
  process.env.PASSWORD = 'secret';
  mockUid.mockResolvedValue(null);
  // Reset alongside mockUid: clearAllMocks keeps mockReturnValue implementations, so a
  // test that flips this to true would otherwise leak into every test after it.
  (wasAuthUnavailable as jest.MockedFunction<typeof wasAuthUnavailable>).mockReturnValue(false);
});

afterAll(() => {
  if (OLD_APIKEY === undefined) delete process.env.APIKEY;
  else process.env.APIKEY = OLD_APIKEY;
  if (OLD_USER === undefined) delete process.env.USER;
  else process.env.USER = OLD_USER;
  if (OLD_PASSWORD === undefined) delete process.env.PASSWORD;
  else process.env.PASSWORD = OLD_PASSWORD;
});

const res = {} as never;

it('rejects basic auth', async () => {
  const creds = Buffer.from('admin:secret').toString('base64');
  const req = {
    headers: { authorization: `Basic ${creds}` },
    url: '/api/domains',
    method: 'GET',
    cookies: {},
  } as never;
  await expect(verifyUser(req, res)).resolves.toBe('Not authorized');
});

it('accepts deprecated APIKEY on whitelist and logs', async () => {
  const req = {
    headers: { authorization: 'Bearer test-api-key', 'x-forwarded-for': '1.2.3.4' },
    url: '/api/domains',
    method: 'GET',
    cookies: {},
    socket: {},
  } as never;
  await expect(verifyUser(req, res)).resolves.toBe('authorized');
  expect(mockLog).toHaveBeenCalledWith(expect.objectContaining({
    endpoint: 'GET:/api/domains',
    ip: '1.2.3.4',
  }));
});

it('accepts Neon session', async () => {
  mockUid.mockResolvedValue('user-1');
  const req = {
    headers: {},
    url: '/api/articles',
    method: 'GET',
    cookies: {},
  } as never;
  await expect(verifyUser(req, res)).resolves.toBe('authorized');
});

// An unreachable auth server is an infrastructure failure, not a verdict about the
// session — the message must say so instead of the lie "Not authorized".
it('names the auth service as the problem when it was unavailable', async () => {
  mockUid.mockResolvedValue(null);
  (wasAuthUnavailable as jest.MockedFunction<typeof wasAuthUnavailable>).mockReturnValue(true);
  const req = {
    headers: {},
    url: '/api/articles/deep-analysis',
    method: 'POST',
    cookies: {},
  } as never;
  await expect(verifyUser(req, res)).resolves.toBe('Authentication service unavailable — please try again');
});
