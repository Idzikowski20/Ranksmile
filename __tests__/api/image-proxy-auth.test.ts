jest.mock('../../utils/verifyUser', () => ({ __esModule: true, default: jest.fn().mockResolvedValue('Not authorized') }));
jest.mock('@/src/infrastructure/http/ssrfGuard', () => ({ ssrfSafeFetch: jest.fn() }));
jest.mock('@/src/infrastructure/billing/requireOrgPaymentAccess', () => ({
  withOrgPaymentAccess: (h: unknown) => h,
  withOrgAccessPolicy: (h: unknown) => h,
}));

import handler from '../../pages/api/image-proxy';
import verifyUser from '../../utils/verifyUser';
import { ssrfSafeFetch } from '@/src/infrastructure/http/ssrfGuard';

const makeRes = () => {
  const res: { status: jest.Mock; json: jest.Mock; send: jest.Mock; setHeader: jest.Mock; end: jest.Mock } = {
    status: jest.fn(),
    json: jest.fn(),
    send: jest.fn(),
    setHeader: jest.fn(),
    end: jest.fn(),
  };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  res.send.mockReturnValue(res);
  return res;
};

it('rejects an unauthenticated image-proxy request before fetching', async () => {
  const res = makeRes();
  await handler({ method: 'GET', query: { url: 'https://example.com/a.png' }, headers: {} } as never, res as never);
  expect(verifyUser).toHaveBeenCalled();
  expect(ssrfSafeFetch).not.toHaveBeenCalled();
  expect(res.status).toHaveBeenCalledWith(401);
});

it('fetches after a session is authorized', async () => {
  (verifyUser as jest.Mock).mockResolvedValueOnce('authorized');
  (ssrfSafeFetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    status: 200,
    headers: { get: () => 'image/png' },
    arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
  });
  const res = makeRes();
  await handler({ method: 'GET', query: { url: 'https://example.com/a.png' }, headers: {} } as never, res as never);
  expect(ssrfSafeFetch).toHaveBeenCalled();
  expect(res.status).toHaveBeenCalledWith(200);
});
