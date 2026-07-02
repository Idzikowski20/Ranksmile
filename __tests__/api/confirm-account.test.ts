jest.mock('../../utils/getUser', () => ({ getCurrentUser: jest.fn() }));
jest.mock('../../lib/emailConfirmation', () => ({
  getConfirmationStatus: jest.fn(),
  issueConfirmationToken: jest.fn(),
  confirmEmailToken: jest.fn(),
}));
jest.mock('../../lib/confirmEmail', () => ({ sendConfirmationEmail: jest.fn() }));

import handler from '../../pages/api/confirm-account';
import { getCurrentUser } from '../../utils/getUser';
import { getConfirmationStatus, issueConfirmationToken, confirmEmailToken } from '../../lib/emailConfirmation';
import { sendConfirmationEmail } from '../../lib/confirmEmail';

const mockGetCurrentUser = getCurrentUser as jest.MockedFunction<typeof getCurrentUser>;
const mockGetConfirmationStatus = getConfirmationStatus as jest.MockedFunction<typeof getConfirmationStatus>;
const mockIssueConfirmationToken = issueConfirmationToken as jest.MockedFunction<typeof issueConfirmationToken>;
const mockConfirmEmailToken = confirmEmailToken as jest.MockedFunction<typeof confirmEmailToken>;
const mockSendConfirmationEmail = sendConfirmationEmail as jest.MockedFunction<typeof sendConfirmationEmail>;

function mockRes() {
  const res: any = {};
  res.statusCode = 200;
  res.status = (c: number) => { res.statusCode = c; return res; };
  res.json = (b: any) => { res.body = b; return res; };
  res.setHeader = () => res;
  return res;
}

function mockReq(overrides: Record<string, unknown> = {}) {
  return {
    method: 'GET',
    body: {},
    query: {},
    headers: {},
    cookies: {},
    ...overrides,
  } as any;
}

describe('/api/confirm-account', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1', email: 'user@example.com' });
  });

  it('401s an unauthenticated GET', async () => {
    mockGetCurrentUser.mockResolvedValueOnce(null);
    const res = mockRes();
    await handler(mockReq({ method: 'GET' }), res);
    expect(res.statusCode).toBe(401);
    expect(mockGetConfirmationStatus).not.toHaveBeenCalled();
  });

  it('401s an unauthenticated POST', async () => {
    mockGetCurrentUser.mockResolvedValueOnce(null);
    const res = mockRes();
    await handler(mockReq({ method: 'POST' }), res);
    expect(res.statusCode).toBe(401);
    expect(mockIssueConfirmationToken).not.toHaveBeenCalled();
  });

  it('GET passes through the confirmation status', async () => {
    mockGetConfirmationStatus.mockResolvedValueOnce({ confirmed: false, email: 'row@example.com', lastSentMs: null });
    const res = mockRes();
    await handler(mockReq({ method: 'GET' }), res);
    expect(mockGetConfirmationStatus).toHaveBeenCalledWith('user-1');
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ confirmed: false, email: 'row@example.com' });
  });

  it('GET falls back to the session email when the row email is null', async () => {
    mockGetConfirmationStatus.mockResolvedValueOnce({ confirmed: false, email: null, lastSentMs: null });
    const res = mockRes();
    await handler(mockReq({ method: 'GET' }), res);
    expect(res.body).toEqual({ confirmed: false, email: 'user@example.com' });
  });

  it('POST sends a confirmation e-mail with a URL containing the raw token and returns sent', async () => {
    mockIssueConfirmationToken.mockResolvedValueOnce({ token: 'raw-token-abc' });
    mockSendConfirmationEmail.mockResolvedValueOnce({ sent: true });
    const res = mockRes();
    await handler(mockReq({
      method: 'POST',
      headers: { origin: 'https://app.example.com' },
    }), res);
    expect(mockIssueConfirmationToken).toHaveBeenCalledWith('user-1', 'user@example.com');
    expect(mockSendConfirmationEmail).toHaveBeenCalledWith(
      'user@example.com',
      'https://app.example.com/auth/confirm-email?token=raw-token-abc',
    );
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ sent: true });
  });

  it('POST falls back to req.headers.host for origin when no origin header or NEXT_PUBLIC_APP_URL is set', async () => {
    const prevAppUrl = process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;
    try {
      mockIssueConfirmationToken.mockResolvedValueOnce({ token: 'raw-token-xyz' });
      mockSendConfirmationEmail.mockResolvedValueOnce({ sent: true });
      const res = mockRes();
      await handler(mockReq({ method: 'POST', headers: { host: 'fallback.example.com' } }), res);
      expect(mockSendConfirmationEmail).toHaveBeenCalledWith(
        'user@example.com',
        'https://fallback.example.com/auth/confirm-email?token=raw-token-xyz',
      );
    } finally {
      if (prevAppUrl !== undefined) process.env.NEXT_PUBLIC_APP_URL = prevAppUrl;
    }
  });

  it('POST prefers NEXT_PUBLIC_APP_URL over req.headers.host when no origin header is present', async () => {
    const prevAppUrl = process.env.NEXT_PUBLIC_APP_URL;
    process.env.NEXT_PUBLIC_APP_URL = 'https://configured.example.com';
    try {
      mockIssueConfirmationToken.mockResolvedValueOnce({ token: 'raw-token-xyz' });
      mockSendConfirmationEmail.mockResolvedValueOnce({ sent: true });
      const res = mockRes();
      await handler(mockReq({ method: 'POST', headers: { host: 'fallback.example.com' } }), res);
      expect(mockSendConfirmationEmail).toHaveBeenCalledWith(
        'user@example.com',
        'https://configured.example.com/auth/confirm-email?token=raw-token-xyz',
      );
    } finally {
      if (prevAppUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
      else process.env.NEXT_PUBLIC_APP_URL = prevAppUrl;
    }
  });

  it('POST returns 429 with cooldownMs during cooldown', async () => {
    mockIssueConfirmationToken.mockResolvedValueOnce({ cooldownMs: 42000 });
    const res = mockRes();
    await handler(mockReq({ method: 'POST' }), res);
    expect(res.statusCode).toBe(429);
    expect(res.body).toEqual({ cooldownMs: 42000 });
    expect(mockSendConfirmationEmail).not.toHaveBeenCalled();
  });

  it('POST returns confirmed:true when already confirmed', async () => {
    mockIssueConfirmationToken.mockResolvedValueOnce({ alreadyConfirmed: true });
    const res = mockRes();
    await handler(mockReq({ method: 'POST' }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ confirmed: true });
    expect(mockSendConfirmationEmail).not.toHaveBeenCalled();
  });

  it('PUT with a valid 64-hex token calls confirmEmailToken and returns { ok: true }', async () => {
    mockConfirmEmailToken.mockResolvedValueOnce({ ok: true });
    const res = mockRes();
    const token = 'a'.repeat(64);
    await handler(mockReq({ method: 'PUT', body: { token } }), res);
    expect(mockConfirmEmailToken).toHaveBeenCalledWith(token);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('PUT does not require a session', async () => {
    mockGetCurrentUser.mockResolvedValueOnce(null);
    mockConfirmEmailToken.mockResolvedValueOnce({ ok: true });
    const res = mockRes();
    const token = 'b'.repeat(64);
    await handler(mockReq({ method: 'PUT', body: { token } }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('PUT rejects a non-string token with 400 and never calls confirmEmailToken', async () => {
    const res = mockRes();
    await handler(mockReq({ method: 'PUT', body: { token: 12345 } }), res);
    expect(res.statusCode).toBe(400);
    expect(mockConfirmEmailToken).not.toHaveBeenCalled();
  });

  it('PUT rejects a token with the wrong length with 400 and never calls confirmEmailToken', async () => {
    const res = mockRes();
    await handler(mockReq({ method: 'PUT', body: { token: 'short' } }), res);
    expect(res.statusCode).toBe(400);
    expect(mockConfirmEmailToken).not.toHaveBeenCalled();
  });

  it('PUT rejects a missing token with 400 and never calls confirmEmailToken', async () => {
    const res = mockRes();
    await handler(mockReq({ method: 'PUT', body: {} }), res);
    expect(res.statusCode).toBe(400);
    expect(mockConfirmEmailToken).not.toHaveBeenCalled();
  });

  it('405s on DELETE', async () => {
    const res = mockRes();
    await handler(mockReq({ method: 'DELETE' }), res);
    expect(res.statusCode).toBe(405);
  });
});
