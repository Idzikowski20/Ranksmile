jest.mock('../../utils/getUser', () => ({ getCurrentUserId: jest.fn().mockResolvedValue('u1') }));
jest.mock('../../lib/tenancy', () => ({
  getActiveWorkspaceId: jest.fn().mockResolvedValue(9),
  getAccessibleWorkspaceIds: jest.fn().mockResolvedValue([9, 10]),
}));
jest.mock('../../lib/workspaces', () => ({
  listWorkspaces: jest.fn().mockResolvedValue([{ id: 9, name: 'Default' }]),
  createWorkspace: jest.fn().mockResolvedValue({ id: 11, name: 'New' }),
  renameWorkspace: jest.fn().mockResolvedValue(undefined),
  deleteWorkspace: jest.fn().mockResolvedValue(undefined),
}));

import listHandler from '../../pages/api/workspaces/index';
import idHandler from '../../pages/api/workspaces/[id]';
import activeHandler from '../../pages/api/workspaces/active';
import { deleteWorkspace } from '../../lib/workspaces';

const makeRes = () => { const r: any = {}; r.status = jest.fn().mockReturnValue(r); r.json = jest.fn().mockReturnValue(r); r.setHeader = jest.fn(); return r; };

describe('/api/workspaces', () => {
  it('GET returns workspaces + activeId', async () => {
    const res = makeRes();
    await listHandler({ method: 'GET', cookies: {} } as any, res);
    expect(res.json).toHaveBeenCalledWith({ workspaces: [{ id: 9, name: 'Default' }], activeId: 9 });
  });
  it('POST creates a workspace', async () => {
    const res = makeRes();
    await listHandler({ method: 'POST', cookies: {}, body: { name: 'New' } } as any, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ id: 11, name: 'New' });
  });
  it('DELETE maps WORKSPACE_NOT_EMPTY to 409', async () => {
    (deleteWorkspace as jest.Mock).mockRejectedValueOnce(new Error('WORKSPACE_NOT_EMPTY'));
    const res = makeRes();
    await idHandler({ method: 'DELETE', cookies: {}, query: { id: '10' } } as any, res);
    expect(res.status).toHaveBeenCalledWith(409);
  });
  it('active POST sets the cookie when the workspace is accessible', async () => {
    const res = makeRes();
    await activeHandler({ method: 'POST', cookies: {}, body: { id: 10 } } as any, res);
    expect(res.setHeader).toHaveBeenCalledWith('Set-Cookie', expect.stringContaining('active_workspace=10'));
    expect(res.status).toHaveBeenCalledWith(200);
  });
  it('active POST rejects a non-accessible workspace with 403', async () => {
    const res = makeRes();
    await activeHandler({ method: 'POST', cookies: {}, body: { id: 999 } } as any, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
