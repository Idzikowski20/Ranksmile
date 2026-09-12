jest.mock('../../utils/verifyUser', () => ({ __esModule: true, default: jest.fn().mockResolvedValue('Not authorized') }));
jest.mock('../../utils/getUser', () => ({ wasAuthUnavailable: jest.fn().mockReturnValue(false) }));
jest.mock('@/src/infrastructure/http/ssrfGuard', () => ({ ssrfSafeFetch: jest.fn() }));

import handler from '../../pages/api/favicon';
import verifyUser from '../../utils/verifyUser';
import { wasAuthUnavailable } from '../../utils/getUser';
import { ssrfSafeFetch } from '@/src/infrastructure/http/ssrfGuard';

const makeRes = () => {
  const res: { status: jest.Mock; send: jest.Mock; setHeader: jest.Mock; end: jest.Mock } = {
    status: jest.fn(),
    send: jest.fn(),
    setHeader: jest.fn(),
    end: jest.fn(),
  };
  res.status.mockReturnValue(res);
  res.send.mockReturnValue(res);
  return res;
};

beforeEach(() => {
  jest.clearAllMocks();
  (verifyUser as jest.Mock).mockResolvedValue('Not authorized');
  (wasAuthUnavailable as jest.Mock).mockReturnValue(false);
});

it('rejects an unauthenticated favicon request before fetching', async () => {
  const res = makeRes();
  await handler({ method: 'GET', query: { domain: 'example.com' }, headers: {} } as never, res as never);
  expect(verifyUser).toHaveBeenCalled();
  expect(ssrfSafeFetch).not.toHaveBeenCalled();
  expect(res.status).toHaveBeenCalledWith(401);
});

it('returns 503 when the auth service is unavailable', async () => {
  (verifyUser as jest.Mock).mockResolvedValueOnce('Authentication service unavailable — please try again');
  (wasAuthUnavailable as jest.Mock).mockReturnValueOnce(true);
  const res = makeRes();
  await handler({ method: 'GET', query: { domain: 'example.com' }, headers: {} } as never, res as never);
  expect(ssrfSafeFetch).not.toHaveBeenCalled();
  expect(res.status).toHaveBeenCalledWith(503);
});

it('fetches after a session is authorized', async () => {
  (verifyUser as jest.Mock).mockResolvedValueOnce('authorized');
  (ssrfSafeFetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    headers: { get: () => 'image/png' },
    arrayBuffer: async () => new Uint8Array(120).buffer,
  });
  const res = makeRes();
  await handler({ method: 'GET', query: { domain: 'example.com' }, headers: {} } as never, res as never);
  expect(ssrfSafeFetch).toHaveBeenCalled();
  expect(res.status).toHaveBeenCalledWith(200);
});
