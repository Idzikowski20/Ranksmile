/** @jest-environment node */
import type { NextApiHandler, NextApiRequest, NextApiResponse } from 'next';

jest.mock('../../utils/getUser', () => ({
  getCurrentUserId: jest.fn(),
  getCurrentUser: jest.fn(),
  wasAuthUnavailable: jest.fn(),
}));

import { getCurrentUserId, wasAuthUnavailable } from '../../utils/getUser';
import { withOrgPaymentAccess } from '@/src/infrastructure/billing/requireOrgPaymentAccess';

const mockUid = getCurrentUserId as jest.MockedFunction<typeof getCurrentUserId>;
const mockUnavail = wasAuthUnavailable as jest.MockedFunction<typeof wasAuthUnavailable>;

function mockRes() {
  const r: Partial<NextApiResponse> & { _status?: number; _json?: unknown } = {};
  r.status = jest.fn((c: number) => { r._status = c; return r as NextApiResponse; });
  r.json = jest.fn((b: unknown) => { r._json = b; return r as NextApiResponse; });
  r.setHeader = jest.fn();
  return r as NextApiResponse & { _status?: number; _json?: unknown };
}
const req = (url: string) => ({
  method: 'POST', url, headers: {}, cookies: { s: 't' }, query: {},
} as unknown as NextApiRequest);

/**
 * When the auth server was down for the whole backoff, the request must reach the
 * client as 503, not 401. This wrapper runs before every handler, so answering here
 * covers all ~117 routes whose handler line is `res.status(401).json({ error })` —
 * none of which has to change. Falling through would let that line turn an outage into
 * a 401 the browser reads as "session expired" and log the user out of a working session.
 */
describe('withOrgPaymentAccess — auth server unavailable', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUid.mockResolvedValue(null);
    mockUnavail.mockReturnValue(false);
  });

  it('answers 503 and never runs the handler when the auth server was unavailable', async () => {
    mockUnavail.mockReturnValue(true);
    const handler = jest.fn() as unknown as NextApiHandler;
    const res = mockRes();

    await withOrgPaymentAccess(handler)(req('/api/articles/deep-analysis'), res);

    expect(res._status).toBe(503);
    expect(handler).not.toHaveBeenCalled();
    expect(res._json).toMatchObject({ code: 'PAYMENT_ACCESS_UNAVAILABLE' });
  });

  it('still lets a plain unauthenticated request through to the handler (401 stays the handler’s call)', async () => {
    mockUnavail.mockReturnValue(false);
    const handler = jest.fn(async (_q, r) => { r.status(401).json({ error: 'Not authorized' }); }) as unknown as NextApiHandler;
    const res = mockRes();

    await withOrgPaymentAccess(handler)(req('/api/articles/deep-analysis'), res);

    expect(handler).toHaveBeenCalled();
    expect(res._status).toBe(401);
  });
});
