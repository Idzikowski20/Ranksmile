jest.mock('sequelize', () => ({ Op: { in: 'Op.in' } }));
jest.mock('../../utils/getUser', () => ({
  getCurrentUserId: jest.fn().mockResolvedValue('u1'),
}));
jest.mock('../../lib/members', () => ({
  changeMemberRole: jest.fn().mockResolvedValue(undefined),
  removeMember: jest.fn().mockResolvedValue(undefined),
  setMemberWorkspaces: jest.fn().mockResolvedValue(undefined),
}));

import idHandler from '../../pages/api/members/[id]';
import wsHandler from '../../pages/api/members/[id]/workspaces';
import { getCurrentUserId } from '../../utils/getUser';
import { changeMemberRole, removeMember, setMemberWorkspaces } from '../../lib/members';

const makeRes = () => { const r: any = {}; r.status = jest.fn().mockReturnValue(r); r.json = jest.fn().mockReturnValue(r); r.setHeader = jest.fn(); return r; };

describe('members [id] mutations API', () => {
  beforeEach(() => {
    (getCurrentUserId as jest.Mock).mockResolvedValue('u1');
    (changeMemberRole as jest.Mock).mockReset().mockResolvedValue(undefined);
    (removeMember as jest.Mock).mockReset().mockResolvedValue(undefined);
    (setMemberWorkspaces as jest.Mock).mockReset().mockResolvedValue(undefined);
  });

  it('PATCH with a valid role returns 200', async () => {
    const res = makeRes();
    await idHandler({ method: 'PATCH', cookies: {}, query: { id: '7' }, body: { role: 'admin' } } as any, res);
    expect(changeMemberRole).toHaveBeenCalledWith('u1', 7, 'admin');
    expect(res.status).toHaveBeenCalledWith(200);
  });
  it('PATCH with an invalid role returns 400 and skips the lib call', async () => {
    const res = makeRes();
    await idHandler({ method: 'PATCH', cookies: {}, query: { id: '7' }, body: { role: 'boss' } } as any, res);
    expect(changeMemberRole).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });
  it('maps FORBIDDEN to 403', async () => {
    (changeMemberRole as jest.Mock).mockRejectedValueOnce(new Error('FORBIDDEN'));
    const res = makeRes();
    await idHandler({ method: 'PATCH', cookies: {}, query: { id: '7' }, body: { role: 'member' } } as any, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });
  it('maps OWNER_LAST to 409', async () => {
    (changeMemberRole as jest.Mock).mockRejectedValueOnce(new Error('OWNER_LAST'));
    const res = makeRes();
    await idHandler({ method: 'PATCH', cookies: {}, query: { id: '7' }, body: { role: 'member' } } as any, res);
    expect(res.status).toHaveBeenCalledWith(409);
  });
  it('DELETE returns 200', async () => {
    const res = makeRes();
    await idHandler({ method: 'DELETE', cookies: {}, query: { id: '7' }, body: {} } as any, res);
    expect(removeMember).toHaveBeenCalledWith('u1', 7);
    expect(res.status).toHaveBeenCalledWith(200);
  });
  it('returns 401 when not authenticated', async () => {
    (getCurrentUserId as jest.Mock).mockResolvedValueOnce(null);
    const res = makeRes();
    await idHandler({ method: 'DELETE', cookies: {}, query: { id: '7' }, body: {} } as any, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });
  it('returns 405 for an unsupported method', async () => {
    const res = makeRes();
    await idHandler({ method: 'GET', cookies: {}, query: { id: '7' }, body: {} } as any, res);
    expect(res.status).toHaveBeenCalledWith(405);
  });
  it('PATCH /workspaces sets access and returns 200', async () => {
    const res = makeRes();
    await wsHandler({ method: 'PATCH', cookies: {}, query: { id: '7' }, body: { workspaceIds: [1, 2] } } as any, res);
    expect(setMemberWorkspaces).toHaveBeenCalledWith('u1', 7, [1, 2]);
    expect(res.status).toHaveBeenCalledWith(200);
  });
  it('PATCH /workspaces with null clears to all-workspaces', async () => {
    const res = makeRes();
    await wsHandler({ method: 'PATCH', cookies: {}, query: { id: '7' }, body: { workspaceIds: null } } as any, res);
    expect(setMemberWorkspaces).toHaveBeenCalledWith('u1', 7, null);
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
