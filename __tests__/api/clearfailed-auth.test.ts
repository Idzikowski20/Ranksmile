jest.mock('../../utils/verifyUser', () => ({ __esModule: true, default: jest.fn().mockResolvedValue('authorized') }));
jest.mock('../../utils/getUser', () => ({ getCurrentUserId: jest.fn().mockResolvedValue('member-1') }));
jest.mock('@/src/infrastructure/identity/members', () => ({ getCallerRole: jest.fn().mockResolvedValue('member') }));
jest.mock('fs/promises', () => ({ writeFile: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/src/infrastructure/billing/requireOrgPaymentAccess', () => ({
  withOrgPaymentAccess: (h: unknown) => h,
  withOrgAccessPolicy: (h: unknown) => h,
}));

import handler from '../../pages/api/clearfailed';
import { getCallerRole } from '@/src/infrastructure/identity/members';
import { writeFile } from 'fs/promises';

const makeRes = () => {
  const res: { status: jest.Mock; json: jest.Mock } = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
};

it('forbids a member from clearing the failed queue', async () => {
  const res = makeRes();
  await handler({ method: 'PUT', headers: {} } as never, res as never);
  expect(getCallerRole).toHaveBeenCalledWith('member-1');
  expect(writeFile).not.toHaveBeenCalled();
  expect(res.status).toHaveBeenCalledWith(403);
});

it('allows an admin to clear the failed queue', async () => {
  (getCallerRole as jest.Mock).mockResolvedValueOnce('admin');
  const res = makeRes();
  await handler({ method: 'PUT', headers: {} } as never, res as never);
  expect(writeFile).toHaveBeenCalled();
  expect(res.status).toHaveBeenCalledWith(200);
});
