jest.mock('../../database/database', () => ({ __esModule: true, default: { query: jest.fn() } }));
jest.mock('../../lib/tenancy', () => ({ ensureUserTenancy: jest.fn().mockResolvedValue({ orgId: 5 }) }));
import db from '../../database/database';
import { listMembers, assertCanManage, changeMemberRole, removeMember, setMemberWorkspaces } from '../../lib/members';
const mockQuery = db.query as jest.Mock;
const rows = (r: unknown[]) => [r, {}];
const lastSql = () => String(mockQuery.mock.calls[mockQuery.mock.calls.length - 1][0]);
const lastRepl = () => mockQuery.mock.calls[mockQuery.mock.calls.length - 1][1].replacements;

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

  describe('changeMemberRole', () => {
    it('admin promoting a member issues the UPDATE', async () => {
      mockQuery.mockResolvedValueOnce(rows([{ role: 'admin' }]));   // caller role
      mockQuery.mockResolvedValueOnce(rows([{ role: 'member' }]));  // target role
      mockQuery.mockResolvedValueOnce(rows([]));                    // UPDATE
      await changeMemberRole('caller', 7, 'admin');
      expect(lastSql()).toContain('UPDATE organization_members SET role');
      expect(lastRepl()).toEqual(['admin', 7, 5]);
    });
    it('an admin cannot touch an owner', async () => {
      mockQuery.mockResolvedValueOnce(rows([{ role: 'admin' }]));   // caller
      mockQuery.mockResolvedValueOnce(rows([{ role: 'owner' }]));   // target is owner
      await expect(changeMemberRole('caller', 7, 'member')).rejects.toThrow('FORBIDDEN');
    });
    it('demoting the last owner throws OWNER_LAST', async () => {
      mockQuery.mockResolvedValueOnce(rows([{ role: 'owner' }]));   // caller
      mockQuery.mockResolvedValueOnce(rows([{ role: 'owner' }]));   // target
      mockQuery.mockResolvedValueOnce(rows([{ n: 1 }]));            // owners count
      await expect(changeMemberRole('caller', 7, 'admin')).rejects.toThrow('OWNER_LAST');
    });
    it('missing member throws MEMBER_NOT_FOUND', async () => {
      mockQuery.mockResolvedValueOnce(rows([{ role: 'admin' }]));   // caller
      mockQuery.mockResolvedValueOnce(rows([]));                    // target not found
      await expect(changeMemberRole('caller', 99, 'member')).rejects.toThrow('MEMBER_NOT_FOUND');
    });
  });

  describe('removeMember', () => {
    it('admin removing a member issues the DELETE', async () => {
      mockQuery.mockResolvedValueOnce(rows([{ role: 'admin' }]));   // caller
      mockQuery.mockResolvedValueOnce(rows([{ role: 'member' }]));  // target
      mockQuery.mockResolvedValueOnce(rows([]));                    // DELETE
      await removeMember('caller', 7);
      expect(lastSql()).toContain('DELETE FROM organization_members');
    });
    it('removing the last owner throws OWNER_LAST', async () => {
      mockQuery.mockResolvedValueOnce(rows([{ role: 'owner' }]));   // caller
      mockQuery.mockResolvedValueOnce(rows([{ role: 'owner' }]));   // target
      mockQuery.mockResolvedValueOnce(rows([{ n: 1 }]));            // owners count
      await expect(removeMember('caller', 7)).rejects.toThrow('OWNER_LAST');
    });
  });

  describe('setMemberWorkspaces', () => {
    it('writes a JSON array of ids', async () => {
      mockQuery.mockResolvedValueOnce(rows([{ role: 'admin' }]));   // assertCanManage
      mockQuery.mockResolvedValueOnce(rows([]));                    // UPDATE
      await setMemberWorkspaces('caller', 7, [1, 2]);
      expect(lastSql()).toContain('SET workspace_ids');
      expect(lastRepl()).toEqual(['[1,2]', 7, 5]);
    });
    it('writes NULL for "all workspaces"', async () => {
      mockQuery.mockResolvedValueOnce(rows([{ role: 'admin' }]));   // assertCanManage
      mockQuery.mockResolvedValueOnce(rows([]));                    // UPDATE
      await setMemberWorkspaces('caller', 7, []);
      expect(lastRepl()).toEqual([null, 7, 5]);
    });
  });
});
