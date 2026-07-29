import type { NextApiRequest, NextApiResponse } from 'next';

jest.mock('../../utils/getUser', () => ({
  getCurrentUserId: jest.fn(),
}));

jest.mock('../../lib/tenancy', () => ({
  ensureUserTenancy: jest.fn(),
}));

jest.mock('../../lib/orgBilling', () => ({
  getOrgBillingState: jest.fn(),
}));

jest.mock('../../lib/wpConnection', () => ({
  resolveByApiKey: jest.fn(),
}));

jest.mock('../../database/database', () => ({
  __esModule: true,
  default: { query: jest.fn() },
}));

import { withOrgPaymentAccess } from '../../lib/requireOrgPaymentAccess';
import { getCurrentUserId } from '../../utils/getUser';
import { ensureUserTenancy } from '../../lib/tenancy';
import { getOrgBillingState } from '../../lib/orgBilling';
import { resolveByApiKey } from '../../lib/wpConnection';
import db from '../../database/database';

type TestResponse = NextApiResponse & { statusCode?: number; body?: unknown };

const makeRes = (): TestResponse => {
  const res = {} as TestResponse;
  res.status = jest.fn((code: number) => {
    res.statusCode = code;
    return res;
  }) as NextApiResponse['status'];
  res.json = jest.fn((body: unknown) => {
    res.body = body;
    return res;
  }) as NextApiResponse['json'];
  return res;
};

const makeReq = (headers: Record<string, string> = {}): NextApiRequest =>
  ({
    method: 'GET',
    url: '/api/inbox',
    query: {},
    cookies: {},
    headers,
  }) as NextApiRequest;

describe('withOrgPaymentAccess', () => {
  const inner = jest.fn(async (_req: NextApiRequest, res: NextApiResponse) => {
    res.status(200).json({ ok: true });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 402 when session org is payment-locked', async () => {
    (getCurrentUserId as jest.Mock).mockResolvedValue('u1');
    (ensureUserTenancy as jest.Mock).mockResolvedValue({ orgId: 7 });
    (getOrgBillingState as jest.Mock).mockResolvedValue({ paymentFailedLockedAt: '2026-01-01T00:00:00.000Z' });

    const res = makeRes();
    await withOrgPaymentAccess(inner)(makeReq(), res);

    expect(res.statusCode).toBe(402);
    expect(res.body).toMatchObject({ code: 'PAYMENT_FAILED_LOCKED' });
    expect(inner).not.toHaveBeenCalled();
  });

  it('fail-closes with 503 when tenancy throws', async () => {
    (getCurrentUserId as jest.Mock).mockResolvedValue('u1');
    (ensureUserTenancy as jest.Mock).mockRejectedValue(new Error('db down'));

    const res = makeRes();
    await withOrgPaymentAccess(inner)(makeReq(), res);

    expect(res.statusCode).toBe(503);
    expect(res.body).toMatchObject({ code: 'PAYMENT_ACCESS_UNAVAILABLE' });
    expect(inner).not.toHaveBeenCalled();
  });

  it('fail-closes with 503 when billing projection throws', async () => {
    (getCurrentUserId as jest.Mock).mockResolvedValue('u1');
    (ensureUserTenancy as jest.Mock).mockResolvedValue({ orgId: 7 });
    (getOrgBillingState as jest.Mock).mockRejectedValue(new Error('billing down'));

    const res = makeRes();
    await withOrgPaymentAccess(inner)(makeReq(), res);

    expect(res.statusCode).toBe(503);
    expect(inner).not.toHaveBeenCalled();
  });

  it('blocks WP api-key traffic for a locked org', async () => {
    (getCurrentUserId as jest.Mock).mockResolvedValue(null);
    (resolveByApiKey as jest.Mock).mockResolvedValue({
      id: 1,
      workspace_id: 42,
      user_id: 'u1',
      site_url: 'https://ex.test',
      api_key: 'k',
      org_name: null,
    });
    (db.query as jest.Mock).mockResolvedValue([[{ org_id: 9 }]]);
    (getOrgBillingState as jest.Mock).mockResolvedValue({ paymentFailedLockedAt: '2026-01-01T00:00:00.000Z' });

    const res = makeRes();
    await withOrgPaymentAccess(inner)(makeReq({ 'api-key': 'k' }), res);

    expect(resolveByApiKey).toHaveBeenCalledWith('k');
    expect(getOrgBillingState).toHaveBeenCalledWith(9);
    expect(res.statusCode).toBe(402);
    expect(inner).not.toHaveBeenCalled();
  });

  it('passes through install-wide callers with no session and no api-key', async () => {
    (getCurrentUserId as jest.Mock).mockResolvedValue(null);

    const res = makeRes();
    await withOrgPaymentAccess(inner)(makeReq(), res);

    expect(inner).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
  });
});
