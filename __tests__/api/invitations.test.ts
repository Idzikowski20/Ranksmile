jest.mock('sequelize', () => ({ Op: { in: 'Op.in' } }));
jest.mock('../../utils/getUser', () => ({
  getCurrentUserId: jest.fn().mockResolvedValue('u1'),
  getCurrentUser: jest.fn().mockResolvedValue({ id: 'u1', email: 'a@b.com' }),
}));
jest.mock('../../lib/members', () => ({ listMembers: jest.fn().mockResolvedValue([]), assertCanManage: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../lib/invitations', () => ({
  listInvitations: jest.fn().mockResolvedValue([]),
  createInvitation: jest.fn().mockResolvedValue({ token: 'tok', email: 'a@b.com', role: 'admin', expires_at: '2026-07-03T00:00:00.000Z' }),
  acceptInvitation: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../lib/organization', () => ({ readOrganization: jest.fn().mockResolvedValue({ name: 'Acme', logoUrl: null }) }));
jest.mock('../../lib/sendMail', () => ({ sendMail: jest.fn().mockResolvedValue({ sent: true }) }));
jest.mock('../../lib/inviteEmail', () => ({ inviteEmailHtml: jest.fn().mockReturnValue('<html>') }));

import membersHandler from '../../pages/api/members/index';
import acceptHandler from '../../pages/api/invitations/[token]/accept';
import { assertCanManage } from '../../lib/members';
import { sendMail } from '../../lib/sendMail';
import { acceptInvitation } from '../../lib/invitations';

const makeRes = () => { const r: any = {}; r.status = jest.fn().mockReturnValue(r); r.json = jest.fn().mockReturnValue(r); r.setHeader = jest.fn(); return r; };

describe('members + accept API', () => {
  it('POST invite by a non-manager returns 403', async () => {
    (assertCanManage as jest.Mock).mockRejectedValueOnce(new Error('FORBIDDEN'));
    const res = makeRes();
    await membersHandler({ method: 'POST', cookies: {}, body: { email: 'x@y.com', role: 'member' } } as any, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });
  it('POST invite by a manager creates + emails', async () => {
    const res = makeRes();
    await membersHandler({ method: 'POST', cookies: {}, body: { email: 'x@y.com', role: 'admin' } } as any, res);
    expect(sendMail).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });
  it('accept with mismatched email returns 409', async () => {
    (acceptInvitation as jest.Mock).mockRejectedValueOnce(new Error('INVITE_EMAIL_MISMATCH'));
    const res = makeRes();
    await acceptHandler({ method: 'POST', cookies: {}, query: { token: 'tok' } } as any, res);
    expect(res.status).toHaveBeenCalledWith(409);
  });
  it('accept success returns 200', async () => {
    const res = makeRes();
    await acceptHandler({ method: 'POST', cookies: {}, query: { token: 'tok' } } as any, res);
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
