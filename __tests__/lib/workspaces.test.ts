jest.mock('../../database/database', () => ({ __esModule: true, default: { query: jest.fn(), transaction: jest.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb({})) } }));
jest.mock('../../lib/tenancy', () => ({ ensureUserTenancy: jest.fn().mockResolvedValue({ orgId: 5, defaultWorkspaceId: 9 }) }));
jest.mock('../../lib/members', () => ({ assertCanManage: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../lib/quota', () => ({
  ensureOrgQuotaBalances: jest.fn().mockResolvedValue(undefined),
  adjustActiveUsage: jest.fn().mockResolvedValue({ used: 1 }),
}));

import db from '../../database/database';
import { listWorkspaces, createWorkspace, renameWorkspace, deleteWorkspace, createSetupWorkspace, markWorkspaceReady, finishWorkspaceSetup } from '../../lib/workspaces';
import { assertCanManage } from '../../lib/members';
import { adjustActiveUsage } from '../../lib/quota';

const mockQuery = db.query as jest.Mock;
const mockAssertCanManage = assertCanManage as jest.MockedFunction<typeof assertCanManage>;
const mockAdjust = adjustActiveUsage as jest.Mock;
const rows = (r: unknown[]) => [r, {}];

describe('workspaces helpers', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockAssertCanManage.mockReset();
    mockAssertCanManage.mockResolvedValue(undefined);
    mockAdjust.mockClear();
    mockAdjust.mockResolvedValue({ used: 1 });
  });

  it('listWorkspaces returns the org workspaces', async () => {
    mockQuery.mockResolvedValueOnce(rows([{ id: 9, name: 'Default' }, { id: 10, name: 'Blog' }]));
    expect(await listWorkspaces('u1')).toEqual([{ id: 9, name: 'Default', domain: null }, { id: 10, name: 'Blog', domain: null }]);
    expect(String(mockQuery.mock.calls[0][0])).toContain('FROM workspaces w WHERE w.org_id = ?');
    expect(String(mockQuery.mock.calls[0][0])).toContain("status = 'ready'");
  });

  it('createWorkspace inserts under the org and returns the new row', async () => {
    mockQuery
      .mockResolvedValueOnce(rows([]))
      .mockResolvedValueOnce(rows([{ id: 11, name: 'New' }]));
    expect(await createWorkspace('u1', 'New')).toEqual({ id: 11, name: 'New' });
    expect(String(mockQuery.mock.calls[0][0])).toContain('INSERT INTO workspaces');
    expect(mockAdjust).toHaveBeenCalled();
  });

  it('renameWorkspace updates only when the workspace is in the org', async () => {
    mockQuery
      .mockResolvedValueOnce(rows([{ id: 10 }]))
      .mockResolvedValueOnce(rows([]));
    await renameWorkspace('u1', 10, 'Renamed');
    expect(String(mockQuery.mock.calls[1][0])).toContain('UPDATE workspaces SET name = ?');
  });

  it('renameWorkspace throws WORKSPACE_NOT_FOUND when not in the org', async () => {
    mockQuery.mockResolvedValueOnce(rows([]));
    await expect(renameWorkspace('u1', 99, 'X')).rejects.toThrow('WORKSPACE_NOT_FOUND');
  });

  it('deleteWorkspace cascades the domain(s) then removes the workspace', async () => {
    mockQuery
      .mockResolvedValueOnce(rows([{ id: 10 }]))
      .mockResolvedValueOnce(rows([{ status: 'ready' }]))
      .mockResolvedValueOnce(rows([{ id: 42, domain: 'x.pl' }]));
    await expect(deleteWorkspace('u1', 10)).resolves.toBeUndefined();
    const sqls = mockQuery.mock.calls.map((c) => String(c[0]));
    expect(sqls.some((s) => s.includes('DELETE FROM domain'))).toBe(true);
    expect(sqls.some((s) => s.includes('DELETE FROM workspaces'))).toBe(true);
    expect(mockAdjust).toHaveBeenCalled();
  });

  it('deleteWorkspace rejects callers who cannot manage the org before deleting data', async () => {
    mockAssertCanManage.mockRejectedValueOnce(new Error('FORBIDDEN'));
    await expect(deleteWorkspace('member', 10)).rejects.toThrow('FORBIDDEN');
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('deleteWorkspace removes even the last workspace (caller then routes to the creator)', async () => {
    mockQuery
      .mockResolvedValueOnce(rows([{ id: 9 }]))
      .mockResolvedValueOnce(rows([{ status: 'ready' }]))
      .mockResolvedValueOnce(rows([{ id: 7, domain: 'only.pl' }]));
    await expect(deleteWorkspace('u1', 9)).resolves.toBeUndefined();
    const sqls = mockQuery.mock.calls.map((c) => String(c[0]));
    expect(sqls.some((s) => s.includes('DELETE FROM workspaces'))).toBe(true);
  });

  it('createSetupWorkspace inserts a setup workspace and returns its id when none exists', async () => {
    mockQuery
      .mockResolvedValueOnce(rows([]))
      .mockResolvedValueOnce(rows([]))
      .mockResolvedValueOnce(rows([{ id: 7 }]));
    const id = await createSetupWorkspace('u1');
    expect(id).toBe(7);
    expect(String(mockQuery.mock.calls[1][0])).toContain('INSERT INTO workspaces');
    expect(String(mockQuery.mock.calls[1][0])).toContain('setup');
  });

  it('createSetupWorkspace reuses an existing in-progress setup workspace', async () => {
    mockQuery.mockResolvedValueOnce(rows([{ id: 4 }]));
    const id = await createSetupWorkspace('u1');
    expect(id).toBe(4);
    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(String(mockQuery.mock.calls[0][0])).toContain("status = 'setup'");
  });

  it('markWorkspaceReady issues an UPDATE setting status = ready', async () => {
    mockQuery
      .mockResolvedValueOnce(rows([{ id: 7 }]))
      .mockResolvedValueOnce(rows([{ status: 'setup' }]))
      .mockResolvedValueOnce(rows([]));
    await markWorkspaceReady('u1', 7, 'My Workspace');
    expect(String(mockQuery.mock.calls[2][0])).toContain("status = 'ready'");
    expect(mockAdjust).toHaveBeenCalled();
  });

  it('finishWorkspaceSetup updates brand_knowledge and marks workspace ready', async () => {
    mockQuery
      .mockResolvedValueOnce(rows([{ id: 7 }]))
      .mockResolvedValueOnce(rows([]))
      .mockResolvedValueOnce(rows([{ id: 7 }]))
      .mockResolvedValueOnce(rows([{ status: 'setup' }]))
      .mockResolvedValueOnce(rows([]));
    await finishWorkspaceSetup('u1', 7, 'Acme', 'We sell widgets');
    const sqls = mockQuery.mock.calls.map((c: unknown[]) => String(c[0]));
    expect(sqls.some((s) => s.includes('UPDATE domain SET brand_knowledge'))).toBe(true);
    expect(sqls.some((s) => s.includes("status = 'ready'"))).toBe(true);
  });
});
