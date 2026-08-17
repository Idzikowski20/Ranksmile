/** @jest-environment node */
import type { NextApiRequest, NextApiResponse } from 'next';

const OLD_ENV = { ...process.env };

const req = () => ({
  method: 'POST',
  url: '/api/articles/deep-analysis',
  cookies: { 'test-session': 'tok-123' },
  query: {},
} as unknown as NextApiRequest);
const res = {} as NextApiResponse;

const okSession = () => ({
  ok: true,
  status: 200,
  json: async () => ({ user: { id: 'u1', email: 'a@b.c' } }),
  body: { cancel: async () => undefined },
});
const http = (status: number) => ({
  ok: false,
  status,
  json: async () => ({}),
  body: { cancel: async () => undefined },
});

/**
 * The auth server being down is not an answer about the user. In dev the mprocs auth
 * pane needs ~7.5s from spawn to listen (measured; longer when embedded Postgres cold
 * boots first), and a single short retry mapped that whole window to 401 "Not
 * authorized". The backoff spans the window; an auth-server 4xx is a real verdict and
 * must not be retried at all.
 */
describe('getCurrentUser — backoff while the auth server is unavailable', () => {
  let fetchMockFn: jest.Mock;

  const load = async () => {
    let mod: typeof import('../../utils/getUser');
    await jest.isolateModulesAsync(async () => {
      mod = await import('../../utils/getUser');
    });
    return mod!;
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    process.env.NEON_AUTH_BASE_URL = 'http://127.0.0.1:8765/api/auth';
    process.env.AUTH_SESSION_COOKIE_NAME = 'test-session';
    fetchMockFn = jest.fn();
    global.fetch = fetchMockFn as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    process.env = { ...OLD_ENV };
  });

  it('rides out a cold-start window: refused connections, then success', async () => {
    fetchMockFn
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockResolvedValue(okSession());

    const { getCurrentUser } = await load();
    const p = getCurrentUser(req(), res);
    await jest.advanceTimersByTimeAsync(10_000);
    await expect(p).resolves.toEqual({ id: 'u1', email: 'a@b.c' });
    expect(fetchMockFn).toHaveBeenCalledTimes(4);
  });

  it('retries a 5xx the same way', async () => {
    fetchMockFn
      .mockResolvedValueOnce(http(502))
      .mockResolvedValue(okSession());

    const { getCurrentUser } = await load();
    const p = getCurrentUser(req(), res);
    await jest.advanceTimersByTimeAsync(10_000);
    await expect(p).resolves.toEqual({ id: 'u1', email: 'a@b.c' });
  });

  it('marks the request auth-unavailable when every attempt fails', async () => {
    fetchMockFn.mockRejectedValue(new Error('ECONNREFUSED'));

    const { getCurrentUser, wasAuthUnavailable } = await load();
    const r = req();
    const p = getCurrentUser(r, res);
    await jest.advanceTimersByTimeAsync(20_000);
    await expect(p).resolves.toBeNull();
    expect(wasAuthUnavailable(r)).toBe(true);
  });

  it('treats an auth-server 401 as the verdict: one call, no retry, not "unavailable"', async () => {
    fetchMockFn.mockResolvedValue(http(401));

    const { getCurrentUser, wasAuthUnavailable } = await load();
    const r = req();
    await expect(getCurrentUser(r, res)).resolves.toBeNull();
    expect(fetchMockFn).toHaveBeenCalledTimes(1);
    expect(wasAuthUnavailable(r)).toBe(false);
  });

  it('a missing cookie is not "unavailable" either', async () => {
    const { getCurrentUser, wasAuthUnavailable } = await load();
    const r = { ...req(), cookies: {} } as unknown as NextApiRequest;
    await expect(getCurrentUser(r, res)).resolves.toBeNull();
    expect(fetchMockFn).not.toHaveBeenCalled();
    expect(wasAuthUnavailable(r)).toBe(false);
  });
});
