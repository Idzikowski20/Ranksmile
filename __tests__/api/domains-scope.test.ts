jest.mock('sequelize', () => ({ Op: { in: 'Op.in', notIn: 'Op.notIn', or: 'Op.or' } }));
jest.mock('../../database/database', () => ({ __esModule: true, default: { sync: jest.fn(), query: jest.fn() } }));
jest.mock('../../database/models/domain', () => ({ __esModule: true, default: { findAll: jest.fn(), bulkCreate: jest.fn(), findOne: jest.fn() } }));
jest.mock('../../database/models/keyword', () => ({ __esModule: true, default: { findAll: jest.fn(), destroy: jest.fn() } }));
jest.mock('../../lib/tenancy', () => ({
  getAccessibleWorkspaceIds: jest.fn(),
  getActiveWorkspaceId: jest.fn(),
}));
jest.mock('../../utils/domains', () => ({ __esModule: true, default: jest.fn(async (d) => d) }));
jest.mock('../../utils/searchConsole', () => ({ checkSerchConsoleIntegration: jest.fn(), removeLocalSCData: jest.fn() }));
jest.mock('../../utils/scraper', () => ({ removeFromRetryQueue: jest.fn() }));
jest.mock('../../utils/verifyUser', () => ({ __esModule: true, default: jest.fn(async () => 'authorized') }));
jest.mock('../../utils/getUser', () => ({ getCurrentUserId: jest.fn(async () => 'user-a') }));

import Domain from '../../database/models/domain';
import { getAccessibleWorkspaceIds, getActiveWorkspaceId } from '../../lib/tenancy';
import { getDomains, addDomain } from '../../pages/api/domains';

const findAll = Domain.findAll as jest.Mock;
const bulkCreate = Domain.bulkCreate as jest.Mock;

const makeRes = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('domains route scoping', () => {
  beforeEach(() => {
    findAll.mockReset(); bulkCreate.mockReset();
    (getAccessibleWorkspaceIds as jest.Mock).mockReset();
    (getActiveWorkspaceId as jest.Mock).mockReset();
  });

  it('getDomains filters Domain.findAll by accessible workspace ids', async () => {
    (getAccessibleWorkspaceIds as jest.Mock).mockResolvedValue([8]);
    findAll.mockResolvedValue([]);
    const res = makeRes();
    await getDomains({ query: {} } as any, res, 'user-a');
    const whereArg = findAll.mock.calls[0][0].where;
    expect(JSON.stringify(whereArg)).toContain('8');
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('addDomain stamps the active workspace id on created domains', async () => {
    (getActiveWorkspaceId as jest.Mock).mockResolvedValue(8);
    bulkCreate.mockResolvedValue([{ get: () => ({ ID: 1 }) }]);
    const res = makeRes();
    await addDomain({ body: { domains: ['a.com'] } } as any, res, 'user-a');
    expect(bulkCreate.mock.calls[0][0][0].workspace_id).toBe(8);
  });
});
