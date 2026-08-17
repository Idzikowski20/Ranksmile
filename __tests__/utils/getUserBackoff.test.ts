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

const cancel = () => jest.fn().mockResolvedValue(undefined);
const okSession = () => ({
  ok: true, status: 200,
  json: async () => ({ user: { id: 'u1', email: 'a@b.c' } }),
  body: { cancel: cancel() },
});
const http = (status: number) => ({
  ok: false, status, json: async () => ({}), body: { cancel: cancel() },
});
/** A 2xx whose body is not JSON — a broken auth response, not a down server. */
const malformed = () => ({
  ok: true, status: 200,
  json: async () => { throw new SyntaxError('Unexpected token <'); },
  body: { cancel: cancel() },
});
/** A server that accepts the connection and never answers. Resolves only via abort. */
const hang = (init?: { signal?: AbortSignal }) => new Promise<never>((_, reject) => {
  init?.signal?.addEventListener('abort', () => reject(new Error('This operation was aborted')));
});

/**
 * The auth server being down is not an answer about the user. In dev the mprocs auth
 * pane needs ~7.5s from spawn to listen (measured), and one short retry mapped that
 * window to 401 "Not authorized". Three retries span the gap the browser actually hits;
 * an auth-server 4xx is a real verdict and is not retried at all; a hung connection is
 * cut per attempt so the bounded window holds.
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
      .mockResolvedValue(okSession());

    const { getCurrentUser } = await load();
    const p = getCurrentUser(req(), res);
    await jest.advanceTimersByTimeAsync(10_000);
    await expect(p).resolves.toEqual({ id: 'u1', email: 'a@b.c' });
    expect(fetchMockFn).toHaveBeenCalledTimes(3);
  });

  it('retries a 5xx the same way and cancels the discarded body', async () => {
    const first = http(502);
    fetchMockFn.mockResolvedValueOnce(first).mockResolvedValue(okSession());

    const { getCurrentUser } = await load();
    const p = getCurrentUser(req(), res);
    await jest.advanceTimersByTimeAsync(10_000);
    await expect(p).resolves.toEqual({ id: 'u1', email: 'a@b.c' });
    expect(first.body.cancel).toHaveBeenCalledTimes(1);
  });

  it('marks the request auth-unavailable when every attempt is refused', async () => {
    fetchMockFn.mockRejectedValue(new Error('ECONNREFUSED'));

    const { getCurrentUser, wasAuthUnavailable } = await load();
    const r = req();
    const p = getCurrentUser(r, res);
    await jest.advanceTimersByTimeAsync(20_000);
    await expect(p).resolves.toBeNull();
    expect(wasAuthUnavailable(r)).toBe(true);
    // initial + 3 retries, no more.
    expect(fetchMockFn).toHaveBeenCalledTimes(4);
  });

  it('marks unavailable on all-5xx too, cancelling every discarded body', async () => {
    const bodies = [http(503), http(503), http(503), http(503)];
    bodies.forEach((b) => fetchMockFn.mockResolvedValueOnce(b));

    const { getCurrentUser, wasAuthUnavailable } = await load();
    const r = req();
    const p = getCurrentUser(r, res);
    await jest.advanceTimersByTimeAsync(20_000);
    await expect(p).resolves.toBeNull();
    expect(wasAuthUnavailable(r)).toBe(true);
    bodies.forEach((b) => expect(b.body.cancel).toHaveBeenCalledTimes(1));
  });

  it('cuts a hung attempt at the per-attempt timeout and keeps retrying', async () => {
    // Node's AbortSignal.timeout runs on an internal timer that jest's fake timers do
    // not drive, so the signal would never fire here. Stand in a signal that fires from
    // a fake-timer setTimeout — the code under test only sees `signal`, so this exercises
    // the same path (attempt aborts → transport failure → next retry).
    const realTimeout = AbortSignal.timeout;
    AbortSignal.timeout = (ms: number) => {
      const c = new AbortController();
      setTimeout(() => c.abort(new Error('This operation was aborted')), ms);
      return c.signal;
    };
    try {
      fetchMockFn
        .mockImplementationOnce((_url: string, init?: { signal?: AbortSignal }) => hang(init))
        .mockResolvedValue(okSession());

      const { getCurrentUser } = await load();
      const p = getCurrentUser(req(), res);
      await jest.advanceTimersByTimeAsync(10_000);
      await expect(p).resolves.toEqual({ id: 'u1', email: 'a@b.c' });
      expect(fetchMockFn).toHaveBeenCalledTimes(2);
    } finally {
      AbortSignal.timeout = realTimeout;
    }
  });

  it('treats an auth-server 401 as the verdict: one call, no retry, not "unavailable"', async () => {
    const r401 = http(401);
    fetchMockFn.mockResolvedValue(r401);

    const { getCurrentUser, wasAuthUnavailable } = await load();
    const r = req();
    await expect(getCurrentUser(r, res)).resolves.toBeNull();
    expect(fetchMockFn).toHaveBeenCalledTimes(1);
    expect(wasAuthUnavailable(r)).toBe(false);
    expect(r401.body.cancel).toHaveBeenCalledTimes(1);
  });

  it('denies a malformed 2xx at once — not a down server, so no backoff and not "unavailable"', async () => {
    fetchMockFn.mockResolvedValue(malformed());

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
