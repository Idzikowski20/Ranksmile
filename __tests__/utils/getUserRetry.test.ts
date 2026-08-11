/** @jest-environment node */
/**
 * A transport failure or a 5xx from the auth server is not "logged out". Both used to
 * leave through the same `return null` and reach the browser as a flat 401, which is
 * what "Analysis failed — Not authorized" was: one blip, every stage still pending, and
 * Try again working because the next call met a healthy server.
 *
 * A 401/403 from that server IS an answer about the session and must not be retried.
 */
import type { NextApiRequest, NextApiResponse } from 'next';

const OLD_BASE_URL = process.env.NEON_AUTH_BASE_URL;
/** Restored after each test — a mock left installed feeds every later suite. */
const REAL_FETCH = global.fetch;

/** Pinned so the suite does not depend on whatever AUTH_SESSION_COOKIE_NAME the env has. */
const COOKIE = 'test-session';

const req = () => ({
  cookies: { [COOKIE]: 'tok' },
  method: 'GET',
  url: '/api/articles/1',
  query: {},
} as unknown as NextApiRequest);

const res = {} as NextApiResponse;

const ok = () => ({
  ok: true,
  status: 200,
  json: async () => ({ user: { id: 'u1', email: 'a@b.c' } }),
});

async function load() {
  let mod!: typeof import('../../utils/getUser');
  await jest.isolateModulesAsync(async () => {
    mod = await import('../../utils/getUser');
  });
  return mod;
}

beforeEach(() => {
  // Assigned in place: getUser reads NEON_AUTH_BASE_URL at module load, and replacing
  // the whole process.env object does not survive into the re-imported module.
  process.env.NEON_AUTH_BASE_URL = 'https://auth.test';
  process.env.AUTH_SESSION_COOKIE_NAME = COOKIE;
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  if (OLD_BASE_URL === undefined) delete process.env.NEON_AUTH_BASE_URL;
  else process.env.NEON_AUTH_BASE_URL = OLD_BASE_URL;
  global.fetch = REAL_FETCH;
  jest.restoreAllMocks();
});

describe('getCurrentUser retry', () => {
  it('retries a 5xx once and accepts the session on the second try', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce({ ok: false, status: 503, body: null })
      .mockResolvedValueOnce(ok());
    global.fetch = fetchMock as unknown as typeof fetch;

    const { getCurrentUser } = await load();

    await expect(getCurrentUser(req(), res)).resolves.toEqual({ id: 'u1', email: 'a@b.c' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries a transport failure once', async () => {
    const fetchMock = jest.fn()
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValueOnce(ok());
    global.fetch = fetchMock as unknown as typeof fetch;

    const { getCurrentUser } = await load();

    await expect(getCurrentUser(req(), res)).resolves.toEqual({ id: 'u1', email: 'a@b.c' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  /** 401 means this token is not a session. Retrying it just delays the same answer. */
  it('does not retry a 401', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: false, status: 401, body: null });
    global.fetch = fetchMock as unknown as typeof fetch;

    const { getCurrentUser } = await load();

    await expect(getCurrentUser(req(), res)).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('gives up after the retry also fails', async () => {
    const fetchMock = jest.fn().mockRejectedValue(new Error('ECONNRESET'));
    global.fetch = fetchMock as unknown as typeof fetch;

    const { getCurrentUser } = await load();

    await expect(getCurrentUser(req(), res)).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  /** The discarded 5xx body is cancelled, or a failing auth server holds the socket. */
  it('cancels the discarded body before retrying', async () => {
    const cancel = jest.fn().mockResolvedValue(undefined);
    const fetchMock = jest.fn()
      .mockResolvedValueOnce({ ok: false, status: 500, body: { cancel } })
      .mockResolvedValueOnce(ok());
    global.fetch = fetchMock as unknown as typeof fetch;

    const { getCurrentUser } = await load();

    await getCurrentUser(req(), res);
    expect(cancel).toHaveBeenCalled();
  });

  /** The last attempt's 5xx body must be released too, not just the retried one. */
  it('cancels the body of a 5xx that is not retried', async () => {
    const cancel = jest.fn().mockResolvedValue(undefined);
    const fetchMock = jest.fn()
      .mockResolvedValueOnce({ ok: false, status: 500, body: { cancel: jest.fn() } })
      .mockResolvedValueOnce({ ok: false, status: 500, body: { cancel } });
    global.fetch = fetchMock as unknown as typeof fetch;

    const { getCurrentUser } = await load();

    await expect(getCurrentUser(req(), res)).resolves.toBeNull();
    expect(cancel).toHaveBeenCalled();
  });
});
