import type { NextApiRequest, NextApiResponse } from 'next';
import handler from '../../pages/api/workspaces/[id]/members';
import { getCurrentUserId } from '../../utils/getUser';
import { getCallerRole } from '../../lib/members';
import { listWorkspaceAccess, setWorkspaceAccess } from '../../lib/workspaceMembers';

jest.mock('../../utils/getUser', () => ({ getCurrentUserId: jest.fn().mockResolvedValue('u1') }));
jest.mock('../../lib/members', () => ({ getCallerRole: jest.fn().mockResolvedValue('owner') }));
jest.mock('../../lib/workspaceMembers', () => ({
  listWorkspaceAccess: jest.fn().mockResolvedValue([]),
  setWorkspaceAccess: jest.fn().mockResolvedValue(undefined),
}));
// The access-policy wrapper has its own coverage; unmocked it resolves real tenancy
// and turns every case below into a 503.
jest.mock('../../lib/requireOrgPaymentAccess', () => ({ withOrgPaymentAccess: (h: unknown) => h }));

const makeRes = () => {
  const r: Record<string, jest.Mock> = {};
  r.status = jest.fn().mockReturnValue(r);
  r.json = jest.fn().mockReturnValue(r);
  r.setHeader = jest.fn();
  return r;
};

const call = (req: Partial<NextApiRequest>, res: Record<string, jest.Mock>) => handler(
  { headers: {}, cookies: {}, body: {}, ...req } as NextApiRequest,
  res as unknown as NextApiResponse,
);

describe('workspaces/[id]/members API', () => {
  beforeEach(() => {
    (getCurrentUserId as jest.Mock).mockResolvedValue('u1');
    (getCallerRole as jest.Mock).mockReset().mockResolvedValue('owner');
    (listWorkspaceAccess as jest.Mock).mockReset().mockResolvedValue([{ id: 3, email: 'm@x', role: 'member', hasAccess: true }]);
    (setWorkspaceAccess as jest.Mock).mockReset().mockResolvedValue(undefined);
  });

  it('GET returns 200 with {role, members}', async () => {
    const res = makeRes();
    await call({ method: 'GET', query: { id: '3' } }, res);
    expect(listWorkspaceAccess).toHaveBeenCalledWith('u1', 3);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ role: 'owner', members: [{ id: 3, email: 'm@x', role: 'member', hasAccess: true }] });
  });

  it('PUT sets access and returns 200', async () => {
    const res = makeRes();
    await call({ method: 'PUT', query: { id: '3' }, body: { memberIds: [1, 2] } }, res);
    expect(setWorkspaceAccess).toHaveBeenCalledWith('u1', 3, [1, 2]);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  it('PUT filters out non-finite member ids', async () => {
    const res = makeRes();
    await call({ method: 'PUT', query: { id: '3' }, body: { memberIds: [1, 'x', null, 2] } }, res);
    expect(setWorkspaceAccess).toHaveBeenCalledWith('u1', 3, [1, 2]);
  });

  it('returns 401 when not authenticated', async () => {
    (getCurrentUserId as jest.Mock).mockResolvedValueOnce(null);
    const res = makeRes();
    await call({ method: 'GET', query: { id: '3' } }, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 405 for an unsupported method', async () => {
    const res = makeRes();
    await call({ method: 'DELETE', query: { id: '3' } }, res);
    expect(res.status).toHaveBeenCalledWith(405);
  });
});
