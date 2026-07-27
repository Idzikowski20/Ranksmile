jest.mock('../../utils/verifyUser', () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue('authorized'),
}));

jest.mock('../../utils/getUser', () => ({
  getCurrentUserId: jest.fn().mockResolvedValue('u1'),
}));

const mockSync = jest.fn().mockResolvedValue(undefined);
const mockList = jest.fn();
const mockMark = jest.fn().mockResolvedValue(undefined);

jest.mock('../../lib/notifications/syncOptimizationInbox', () => ({
  syncOptimizationInbox: (...args: unknown[]) => mockSync(...args),
}));

jest.mock('../../lib/notifications/inboxService', () => ({
  listInboxForUser: (...args: unknown[]) => mockList(...args),
  markInboxRead: (...args: unknown[]) => mockMark(...args),
}));

jest.mock('../../lib/tenancy', () => ({
  ensureUserTenancy: jest.fn().mockResolvedValue({ orgId: 5 }),
  getAccessibleWorkspaceIds: jest.fn().mockResolvedValue([9, 10]),
}));

import verifyUser from '../../utils/verifyUser';
import { getCurrentUserId } from '../../utils/getUser';
import inboxHandler from '../../pages/api/inbox/index';
import markReadHandler from '../../pages/api/inbox/mark-read';

const makeRes = () => {
  const r: { status: jest.Mock; json: jest.Mock; setHeader: jest.Mock } = {
    status: jest.fn(),
    json: jest.fn(),
    setHeader: jest.fn(),
  };
  r.status.mockReturnValue(r);
  r.json.mockReturnValue(r);
  return r;
};

describe('GET /api/inbox', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (verifyUser as jest.Mock).mockResolvedValue('authorized');
    (getCurrentUserId as jest.Mock).mockResolvedValue('u1');
    mockList.mockResolvedValue({
      unreadCount: 2,
      items: [{
        eventId: 'optimization_recommendation:domain:1',
        type: 'optimization_recommendation',
        title: 'New optimization recommendation',
        body: 'You have 2 new recommendations to optimize your content.',
        href: '/sites/a/recommendations',
        domain: 'a.com',
        slug: 'a',
        count: 2,
        at: '2026-01-01T00:00:00.000Z',
        revision: 1,
        isRead: false,
      }],
    });
  });

  it('syncs then lists inbox', async () => {
    const res = makeRes();
    await inboxHandler({ method: 'GET', cookies: {}, query: {} } as never, res);
    expect(mockSync).toHaveBeenCalledWith(5, [9, 10]);
    expect(mockList).toHaveBeenCalledWith('u1', { unreadOnly: false, limit: 50 });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ unreadCount: 2 }));
  });

  it('passes unreadOnly and limit', async () => {
    const res = makeRes();
    await inboxHandler({
      method: 'GET', cookies: {}, query: { unreadOnly: '1', limit: '10' },
    } as never, res);
    expect(mockList).toHaveBeenCalledWith('u1', { unreadOnly: true, limit: 10 });
  });

  it('returns 401 without auth', async () => {
    (verifyUser as jest.Mock).mockResolvedValueOnce('Unauthorized');
    const res = makeRes();
    await inboxHandler({ method: 'GET', cookies: {}, query: {} } as never, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });
});

describe('POST /api/inbox/mark-read', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (verifyUser as jest.Mock).mockResolvedValue('authorized');
    (getCurrentUserId as jest.Mock).mockResolvedValue('u1');
  });

  it('marks specific eventIds', async () => {
    const res = makeRes();
    await markReadHandler({
      method: 'POST',
      cookies: {},
      body: { eventIds: ['optimization_recommendation:domain:1'] },
    } as never, res);
    expect(mockMark).toHaveBeenCalledWith('u1', {
      eventIds: ['optimization_recommendation:domain:1'],
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('marks all', async () => {
    const res = makeRes();
    await markReadHandler({ method: 'POST', cookies: {}, body: { all: true } } as never, res);
    expect(mockMark).toHaveBeenCalledWith('u1', { all: true });
  });

  it('rejects all + eventIds with 400', async () => {
    const res = makeRes();
    await markReadHandler({
      method: 'POST',
      cookies: {},
      body: { all: true, eventIds: ['x'] },
    } as never, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockMark).not.toHaveBeenCalled();
  });

  it('rejects >100 eventIds', async () => {
    const res = makeRes();
    const eventIds = Array.from({ length: 101 }, (_, i) => `e${i}`);
    await markReadHandler({ method: 'POST', cookies: {}, body: { eventIds } } as never, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 401 without auth', async () => {
    (verifyUser as jest.Mock).mockResolvedValueOnce('Unauthorized');
    const res = makeRes();
    await markReadHandler({ method: 'POST', cookies: {}, body: { all: true } } as never, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });
});
