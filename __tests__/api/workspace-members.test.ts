jest.mock('../../utils/getUser', () => ({ getCurrentUserId: jest.fn().mockResolvedValue('u1') }));
jest.mock('../../lib/members', () => ({ getCallerRole: jest.fn().mockResolvedValue('owner') }));
jest.mock('../../lib/workspaceMembers', () => ({
  listWorkspaceAccess: jest.fn().mockResolvedValue([]),
  setWorkspaceAccess: jest.fn().mockResolvedValue(undefined),
}));

import handler from '../../pages/api/workspaces/[id]/members';
import { getCurrentUserId } from '../../utils/getUser';
import { getCallerRole } from '../../lib/members';
import { listWorkspaceAccess, setWorkspaceAccess } from '../../lib/workspaceMembers';

const makeRes = () => { const r: any = {}; r.status = jest.fn().mockReturnValue(r); r.json = jest.fn().mockReturnValue(r); r.setHeader = jest.fn(); return r; };

describe('workspaces/[id]/members API', () => {
  beforeEach(() => {
    (getCurrentUserId as jest.Mock).mockResolvedValue('u1');
    (getCallerRole as jest.Mock).mockReset().mockResolvedValue('owner');
    (listWorkspaceAccess as jest.Mock).mockReset().mockResolvedValue([{ id: 3, email: 'm@x', role: 'member', hasAccess: true }]);
    (setWorkspaceAccess as jest.Mock).mockReset().mockResolvedValue(undefined);
  });

  it('GET returns 200 with {role, members}', async () => {
    const res = makeRes();
    await handler({ method: 'GET', cookies: {}, query: { id: '3' }, body: {} } as any, res);
    expect(listWorkspaceAccess).toHaveBeenCalledWith('u1', 3);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ role: 'owner', members: [{ id: 3, email: 'm@x', role: 'member', hasAccess: true }] });
  });

  it('PUT sets access and returns 200', async () => {
    const res = makeRes();
    await handler({ method: 'PUT', cookies: {}, query: { id: '3' }, body: { memberIds: [1, 2] } } as any, res);
    expect(setWorkspaceAccess).toHaveBeenCalledWith('u1', 3, [1, 2]);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  it('PUT filters out non-finite member ids', async () => {
    const res = makeRes();
    await handler({ method: 'PUT', cookies: {}, query: { id: '3' }, body: { memberIds: [1, 'x', null, 2] } } as any, res);
    expect(setWorkspaceAccess).toHaveBeenCalledWith('u1', 3, [1, 2]);
  });

  it('returns 401 when not authenticated', async () => {
    (getCurrentUserId as jest.Mock).mockResolvedValueOnce(null);
    const res = makeRes();
    await handler({ method: 'GET', cookies: {}, query: { id: '3' }, body: {} } as any, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 405 for an unsupported method', async () => {
    const res = makeRes();
    await handler({ method: 'DELETE', cookies: {}, query: { id: '3' }, body: {} } as any, res);
    expect(res.status).toHaveBeenCalledWith(405);
  });
});
