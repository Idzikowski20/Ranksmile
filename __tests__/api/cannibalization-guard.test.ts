jest.mock('sequelize', () => ({ Op: { in: 'Op.in' } }));
jest.mock('../../utils/getUser', () => ({ getCurrentUserId: jest.fn().mockResolvedValue('intruder') }));
jest.mock('../../utils/verifyDomainOwnership', () => ({ verifyDomainOwnershipBySlug: jest.fn().mockResolvedValue(false) }));
jest.mock('../../database/database', () => ({ __esModule: true, default: { query: jest.fn().mockResolvedValue([[]]), sync: jest.fn().mockResolvedValue(undefined) } }));
jest.mock('../../utils/verifyUser', () => ({ __esModule: true, default: jest.fn().mockResolvedValue('authorized') }));

import handler from '../../pages/api/domains/[slug]/cannibalization';

const makeRes = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn();
  return res;
};

it('denies cannibalization data for a domain the caller does not own', async () => {
  const res = makeRes();
  await handler({ method: 'GET', query: { slug: 'victim-site' }, cookies: {} } as any, res);
  expect(res.status).toHaveBeenCalledWith(403);
});
