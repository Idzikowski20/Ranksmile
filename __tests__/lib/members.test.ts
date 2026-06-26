jest.mock('../../database/database', () => ({ __esModule: true, default: { query: jest.fn() } }));
jest.mock('../../lib/tenancy', () => ({ ensureUserTenancy: jest.fn().mockResolvedValue({ orgId: 5 }) }));
import db from '../../database/database';
import { listMembers, assertCanManage } from '../../lib/members';
const mockQuery = db.query as jest.Mock;
const rows = (r: unknown[]) => [r, {}];

describe('members', () => {
  beforeEach(() => mockQuery.mockReset());
  it('listMembers returns the org members', async () => {
    mockQuery.mockResolvedValueOnce(rows([{ id: 1, user_id: 'u1', role: 'owner', status: 'active', workspace_ids: null }]));
    const m = await listMembers('u1');
    expect(m).toHaveLength(1);
    expect(String(mockQuery.mock.calls[0][0])).toContain('FROM organization_members WHERE org_id = ?');
  });
  it('assertCanManage allows admin', async () => {
    mockQuery.mockResolvedValueOnce(rows([{ role: 'admin' }]));
    await expect(assertCanManage('u1')).resolves.toBeUndefined();
  });
  it('assertCanManage throws FORBIDDEN for member', async () => {
    mockQuery.mockResolvedValueOnce(rows([{ role: 'member' }]));
    await expect(assertCanManage('u1')).rejects.toThrow('FORBIDDEN');
  });
});
