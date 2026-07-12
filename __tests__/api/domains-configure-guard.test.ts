jest.mock('../../database/database', () => ({
  __esModule: true,
  default: { sync: jest.fn().mockResolvedValue(undefined), query: jest.fn() },
}));
jest.mock('../../database/models/domain', () => ({
  __esModule: true,
  default: { findOrCreate: jest.fn() },
}));
jest.mock('../../utils/verifyUser', () => ({ __esModule: true, default: jest.fn().mockResolvedValue('authorized') }));
jest.mock('../../utils/getUser', () => ({ getCurrentUserId: jest.fn().mockResolvedValue('user-1') }));
jest.mock('../../lib/ensureArticlesTables', () => ({ ensureArticlesTables: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../lib/tenancy', () => ({
  getActiveWorkspaceId: jest.fn().mockResolvedValue(123),
  getAccessibleWorkspaceIds: jest.fn().mockResolvedValue([123]),
}));
jest.mock('../../lib/workspaces', () => ({
  getWorkspace: jest.fn().mockResolvedValue({ id: 123, status: 'setup' }),
}));
jest.mock('../../lib/gscProperty', () => ({ mergeGscProperty: jest.fn() }));

import db from '../../database/database';
import Domain from '../../database/models/domain';
import handler from '../../pages/api/domains/configure';

const makeRes = () => {
  const res: { status: jest.Mock; json: jest.Mock; setHeader: jest.Mock } = {
    status: jest.fn(),
    json: jest.fn(),
    setHeader: jest.fn(),
  };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
};

beforeEach(() => {
  jest.clearAllMocks();
});

it('does not attach an existing domain from an inaccessible workspace during setup', async () => {
  (Domain.findOrCreate as jest.Mock).mockResolvedValue([
    { ID: 45, domain: 'victim.com', slug: 'victim-com', workspace_id: 999, search_console: null },
    false,
  ]);
  const res = makeRes();

  await handler({
    method: 'POST',
    body: { domain: 'victim.com', workspaceId: 123, pages: [] },
    cookies: {},
  } as never, res as never);

  expect(res.status).toHaveBeenCalledWith(403);
  expect((db.query as jest.Mock).mock.calls.some(([sql]) => String(sql).includes('UPDATE domain SET workspace_id'))).toBe(false);
});
