jest.mock('../../utils/verifyUser', () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue('authorized'),
}));

jest.mock('../../pages/api/settings', () => ({
  getAppSettings: jest.fn().mockResolvedValue({
    notification_interval: 'daily',
    notification_email: 'fallback@ranksmile.com',
  }),
}));

const mockEnqueue = jest.fn();
jest.mock('../../lib/notifications/emailQueue', () => ({
  enqueueKeywordPositionEmails: (...args: unknown[]) => mockEnqueue(...args),
}));

jest.mock('../../database/database', () => ({
  __esModule: true,
  default: {
    sync: jest.fn().mockResolvedValue(undefined),
    query: jest.fn(async (sql: string) => {
      const s = String(sql);
      if (s.includes('FROM domain')) {
        return [[
          {
            domain_id: 1,
            domain: 'a.com',
            notification: true,
            notification_emails: 'a@x.com',
            org_id: 9,
          },
          {
            domain_id: 2,
            domain: 'b.com',
            notification: false,
            notification_emails: 'b@x.com',
            org_id: 9,
          },
        ], {}];
      }
      return [[], {}];
    }),
  },
}));

import verifyUser from '../../utils/verifyUser';
import notifyHandler from '../../pages/api/notify';

const makeRes = () => {
  const r: { status: jest.Mock; json: jest.Mock } = {
    status: jest.fn(),
    json: jest.fn(),
  };
  r.status.mockReturnValue(r);
  r.json.mockReturnValue(r);
  return r;
};

describe('POST /api/notify', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (verifyUser as jest.Mock).mockResolvedValue('authorized');
    mockEnqueue.mockResolvedValue({
      enqueued: 1,
      skipped: 1,
      existing: 0,
      periodKey: '2026-07-27',
    });
  });

  it('returns 202 with counters', async () => {
    const res = makeRes();
    await notifyHandler({ method: 'POST', query: {}, cookies: {} } as never, res);
    expect(res.status).toHaveBeenCalledWith(202);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      enqueued: 1,
      skipped: 1,
    }));
    expect(mockEnqueue).toHaveBeenCalled();
  });

  it('returns 401 without auth', async () => {
    (verifyUser as jest.Mock).mockResolvedValueOnce('Unauthorized');
    const res = makeRes();
    await notifyHandler({ method: 'POST', query: {}, cookies: {} } as never, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(mockEnqueue).not.toHaveBeenCalled();
  });
});
