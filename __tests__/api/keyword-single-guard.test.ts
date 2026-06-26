jest.mock('sequelize', () => ({ Op: { in: 'Op.in' } }));
jest.mock('../../utils/getUser', () => ({ getCurrentUserId: jest.fn().mockResolvedValue('intruder') }));
jest.mock('../../utils/verifyDomainOwnership', () => ({ verifyDomainOwnership: jest.fn().mockResolvedValue(false) }));
jest.mock('../../database/database', () => ({ __esModule: true, default: { query: jest.fn(), sync: jest.fn().mockResolvedValue(undefined) } }));
jest.mock('../../database/models/keyword', () => ({
  __esModule: true,
  default: { findOne: jest.fn().mockResolvedValue({ domain: 'victim.com', get: () => ({ ID: 5, domain: 'victim.com' }) }) },
}));
jest.mock('../../utils/verifyUser', () => ({ __esModule: true, default: jest.fn().mockResolvedValue('authorized') }));
jest.mock('../../utils/parseKeywords', () => ({ __esModule: true, default: jest.fn().mockReturnValue([{ ID: 5 }]) }));

import handler from '../../pages/api/keyword';

const makeRes = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn();
  return res;
};

it('denies reading a keyword whose domain the caller does not own', async () => {
  const res = makeRes();
  await handler({ method: 'GET', query: { id: '5' }, cookies: {} } as any, res);
  expect(res.status).toHaveBeenCalledWith(403);
});
