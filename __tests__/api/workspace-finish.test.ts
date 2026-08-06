import type { NextApiRequest, NextApiResponse } from 'next';
import { getCurrentUserId } from '../../utils/getUser';
import { finishWorkspaceSetup } from '../../lib/workspaces';
import handler from '../../pages/api/workspaces/[id]/finish';

jest.mock('../../utils/getUser', () => ({ getCurrentUserId: jest.fn().mockResolvedValue('u1') }));
jest.mock('../../lib/workspaces', () => ({ finishWorkspaceSetup: jest.fn().mockResolvedValue(undefined) }));
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

describe('POST /api/workspaces/[id]/finish', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getCurrentUserId as jest.Mock).mockResolvedValue('u1');
    (finishWorkspaceSetup as jest.Mock).mockResolvedValue(undefined);
  });

  it('returns 401 when not authenticated', async () => {
    (getCurrentUserId as jest.Mock).mockResolvedValue(null);
    const res = makeRes();
    await call({ method: 'POST', query: { id: '7' }, body: { brandName: 'Acme', brandKnowledge: 'We sell widgets' } }, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 405 on non-POST methods', async () => {
    const res = makeRes();
    await call({ method: 'GET', query: { id: '7' }, body: {} }, res);
    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.setHeader).toHaveBeenCalledWith('Allow', 'POST');
  });

  it('returns 400 when brandName is missing', async () => {
    const res = makeRes();
    await call({ method: 'POST', query: { id: '7' }, body: { brandKnowledge: 'Some knowledge' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 when brandName is blank', async () => {
    const res = makeRes();
    await call({ method: 'POST', query: { id: '7' }, body: { brandName: '   ', brandKnowledge: '' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 200 with {ok:true} and calls finishWorkspaceSetup on valid POST', async () => {
    const res = makeRes();
    await call({ method: 'POST', query: { id: '7' }, body: { brandName: 'Acme', brandKnowledge: 'We sell widgets' } }, res);
    expect(finishWorkspaceSetup).toHaveBeenCalledWith('u1', 7, 'Acme', 'We sell widgets');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  it('returns 404 when finishWorkspaceSetup throws WORKSPACE_NOT_FOUND', async () => {
    (finishWorkspaceSetup as jest.Mock).mockRejectedValueOnce(new Error('WORKSPACE_NOT_FOUND'));
    const res = makeRes();
    await call({ method: 'POST', query: { id: '7' }, body: { brandName: 'Acme', brandKnowledge: '' } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});
