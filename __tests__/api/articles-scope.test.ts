jest.mock('sequelize', () => ({ Op: { in: 'Op.in', notIn: 'Op.notIn', or: 'Op.or' } }));
jest.mock('../../database/database', () => ({ __esModule: true, default: { query: jest.fn(), sync: jest.fn() } }));
jest.mock('../../database/models/domain', () => ({ __esModule: true, default: { findAll: jest.fn(), findOne: jest.fn() } }));
jest.mock('../../lib/tenancy', () => ({ getAccessibleWorkspaceIds: jest.fn() }));
jest.mock('../../utils/verifyUser', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('../../utils/getUser', () => ({ getCurrentUserId: jest.fn() }));
jest.mock('../../lib/ensureArticlesTables', () => ({ ensureArticlesTables: jest.fn() }));
jest.mock('../../lib/articleSql', () => ({ getArticleIdSql: jest.fn() }));

import Domain from '../../database/models/domain';
import { getAccessibleWorkspaceIds } from '../../lib/tenancy';
import { getUserDomainIds } from '../../pages/api/articles/index';

const findAll = Domain.findAll as jest.Mock;

describe('articles getUserDomainIds (workspace-scoped)', () => {
  beforeEach(() => { findAll.mockReset(); (getAccessibleWorkspaceIds as jest.Mock).mockReset(); });

  it('queries domains by accessible workspace ids and returns their IDs', async () => {
    (getAccessibleWorkspaceIds as jest.Mock).mockResolvedValue([8]);
    findAll.mockResolvedValue([{ ID: 1 }, { ID: 2 }]);
    const ids = await getUserDomainIds('user-a');
    expect(JSON.stringify(findAll.mock.calls[0][0].where)).toContain('8');
    expect(ids).toEqual([1, 2]);
  });
});
