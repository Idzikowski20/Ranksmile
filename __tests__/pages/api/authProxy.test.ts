/**
 * @jest-environment node
 */
import type { NextApiRequest, NextApiResponse } from 'next';

type Handler = (req: NextApiRequest, res: NextApiResponse) => Promise<void>;

// The route reads NEON_AUTH_BASE_URL at module load and 503s without it. Static imports
// are hoisted above any assignment, so the module has to be pulled in after the env is set.
let handler: Handler;

beforeAll(async () => {
  process.env.NEON_AUTH_BASE_URL = 'http://auth.test/api/auth';
  ({ default: handler } = await import('../../../pages/api/auth/[...auth0]') as { default: Handler });
});

/**
 * Sign-in emits several Set-Cookie headers at once — the session token plus
 * `session_data` and `dont_remember`. `res.setHeader` OVERWRITES rather than appends, so
 * relaying them one-by-one inside the header loop kept only whichever the upstream
 * emitted last, and the session token was routinely the one dropped. The browser stored a
 * partial cookie set and the session appeared to reset at random.
 */
const SIGN_IN_COOKIES = [
  'better-auth.session_token=THE-REAL-SESSION; Path=/; HttpOnly; SameSite=Lax',
  'better-auth.session_data=CCC; Path=/; HttpOnly; Expires=Sat, 16 Aug 2026 12:00:00 GMT',
  'better-auth.dont_remember=1; Path=/; HttpOnly',
];

function mockRes() {
  const headers = new Map<string, string | string[]>();
  const res = {
    setHeader: jest.fn((k: string, v: string | string[]) => { headers.set(k.toLowerCase(), v); }),
    status: jest.fn(() => res),
    json: jest.fn(() => res),
    end: jest.fn(() => res),
  } as unknown as NextApiResponse;
  return { res, headers };
}

function mockReq(): NextApiRequest {
  return {
    method: 'POST',
    query: { auth0: ['sign-in', 'email'] },
    headers: { origin: 'http://localhost:3000' },
    body: { email: 'a@b.pl' },
  } as unknown as NextApiRequest;
}

/**
 * A hand-built stand-in rather than a real `Response`: the platform's Headers is exactly
 * what differs between runtimes (jsdom has none of getSetCookie, and the runner
 * substitutes its own), while what needs asserting here is the route's relay logic.
 */
function upstreamReply(cookies: string[], opts?: { withGetSetCookie?: boolean }): Response {
  const plain: Record<string, string> = { 'content-type': 'application/json', 'x-other': 'kept' };
  const headers = {
    forEach(cb: (value: string, key: string) => void) {
      for (const [k, v] of Object.entries(plain)) cb(v, k);
      if (cookies.length) cb(cookies.join(', '), 'set-cookie');
    },
    get: (k: string) => (k.toLowerCase() === 'set-cookie'
      ? (cookies.join(', ') || null)
      : plain[k.toLowerCase()] ?? null),
    ...(opts?.withGetSetCookie === false ? {} : { getSetCookie: () => cookies }),
  };
  return {
    status: 200,
    headers,
    arrayBuffer: async () => new ArrayBuffer(0),
  } as unknown as Response;
}

describe('auth proxy Set-Cookie relay', () => {
  afterEach(() => { jest.restoreAllMocks(); });

  it('relays every Set-Cookie the upstream sent, session token included', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(upstreamReply(SIGN_IN_COOKIES));
    const { res, headers } = mockRes();

    await handler(mockReq(), res);

    expect(headers.get('set-cookie')).toEqual(SIGN_IN_COOKIES);
  });

  it('still relays ordinary headers', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(upstreamReply(SIGN_IN_COOKIES));
    const { res, headers } = mockRes();

    await handler(mockReq(), res);

    expect(headers.get('x-other')).toBe('kept');
  });

  it('sets no Set-Cookie header when the upstream sent none', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(upstreamReply([]));
    const { res, headers } = mockRes();

    await handler(mockReq(), res);

    expect(headers.has('set-cookie')).toBe(false);
  });

  it('falls back to the combined header when getSetCookie is unavailable', async () => {
    // Missing on Node < 18.14 and in jsdom; calling it blindly would 502 every auth request.
    jest.spyOn(global, 'fetch')
      .mockResolvedValue(upstreamReply(SIGN_IN_COOKIES, { withGetSetCookie: false }));
    const { res, headers } = mockRes();

    await handler(mockReq(), res);

    expect(headers.get('set-cookie')).toEqual([SIGN_IN_COOKIES.join(', ')]);
  });
});
