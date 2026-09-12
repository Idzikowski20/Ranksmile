jest.mock('../../utils/verifyUser', () => ({ __esModule: true, default: jest.fn().mockResolvedValue('Not authorized') }));
jest.mock('@/src/infrastructure/http/ssrfGuard', () => ({ ssrfSafeFetch: jest.fn() }));
jest.mock('@/src/infrastructure/billing/requireOrgPaymentAccess', () => ({
  withOrgPaymentAccess: (h: unknown) => h,
  withOrgAccessPolicy: (h: unknown) => h,
}));

import handler from '../../pages/api/favicon';
import verifyUser from '../../utils/verifyUser';
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

it('rejects an unauthenticated favicon request before fetching', async () => {
  const res = makeRes();
  await handler({ method: 'GET', query: { domain: 'example.com' }, headers: {} } as never, res as never);
  expect(verifyUser).toHaveBeenCalled();
  expect(ssrfSafeFetch).not.toHaveBeenCalled();
  expect(res.status).toHaveBeenCalledWith(401);
});
