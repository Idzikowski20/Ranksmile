jest.mock('../../database/database', () => ({ __esModule: true, default: { query: jest.fn() } }));
jest.mock('../../lib/tenancy', () => ({ ensureUserTenancy: jest.fn().mockResolvedValue({ orgId: 5, defaultWorkspaceId: 9 }) }));

import db from '../../database/database';
import { listWorkspaces, createWorkspace, renameWorkspace, deleteWorkspace } from '../../lib/workspaces';

const mockQuery = db.query as jest.Mock;
const rows = (r: unknown[]) => [r, {}];

describe('workspaces helpers', () => {
  beforeEach(() => mockQuery.mockReset());

  it('listWorkspaces returns the org workspaces', async () => {
    mockQuery.mockResolvedValueOnce(rows([{ id: 9, name: 'Default' }, { id: 10, name: 'Blog' }]));
    expect(await listWorkspaces('u1')).toEqual([{ id: 9, name: 'Default' }, { id: 10, name: 'Blog' }]);
    expect(String(mockQuery.mock.calls[0][0])).toContain('FROM workspaces WHERE org_id = ?');
  });

  it('createWorkspace inserts under the org and returns the new row', async () => {
    mockQuery
      .mockResolvedValueOnce(rows([]))                          // INSERT
      .mockResolvedValueOnce(rows([{ id: 11, name: 'New' }]));  // SELECT back
    expect(await createWorkspace('u1', 'New')).toEqual({ id: 11, name: 'New' });
    expect(String(mockQuery.mock.calls[0][0])).toContain('INSERT INTO workspaces');
  });

  it('renameWorkspace updates only when the workspace is in the org', async () => {
    mockQuery
      .mockResolvedValueOnce(rows([{ id: 10 }]))   // ownership SELECT
      .mockResolvedValueOnce(rows([]));            // UPDATE
    await renameWorkspace('u1', 10, 'Renamed');
    expect(String(mockQuery.mock.calls[1][0])).toContain('UPDATE workspaces SET name = ?');
  });

  it('renameWorkspace throws WORKSPACE_NOT_FOUND when not in the org', async () => {
    mockQuery.mockResolvedValueOnce(rows([]));     // ownership SELECT -> none
    await expect(renameWorkspace('u1', 99, 'X')).rejects.toThrow('WORKSPACE_NOT_FOUND');
  });

  it('deleteWorkspace blocks deleting a non-empty workspace', async () => {
    mockQuery
      .mockResolvedValueOnce(rows([{ id: 10 }]))   // ownership
      .mockResolvedValueOnce(rows([{ n: 3 }]))     // workspace count in org (>1)
      .mockResolvedValueOnce(rows([{ n: 2 }]));    // domain count (>0) -> block
    await expect(deleteWorkspace('u1', 10)).rejects.toThrow('WORKSPACE_NOT_EMPTY');
  });

  it('deleteWorkspace blocks deleting the last workspace', async () => {
    mockQuery
      .mockResolvedValueOnce(rows([{ id: 9 }]))    // ownership
      .mockResolvedValueOnce(rows([{ n: 1 }]));    // only one workspace -> block
    await expect(deleteWorkspace('u1', 9)).rejects.toThrow('WORKSPACE_LAST');
  });

  it('deleteWorkspace deletes an empty non-last workspace', async () => {
    mockQuery
      .mockResolvedValueOnce(rows([{ id: 10 }]))   // ownership
      .mockResolvedValueOnce(rows([{ n: 2 }]))     // workspace count >1
      .mockResolvedValueOnce(rows([{ n: 0 }]))     // domain count 0
      .mockResolvedValueOnce(rows([]));            // DELETE
    await deleteWorkspace('u1', 10);
    expect(String(mockQuery.mock.calls[3][0])).toContain('DELETE FROM workspaces');
  });
});
