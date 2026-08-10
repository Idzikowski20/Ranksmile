/**
 * @jest-environment node
 */
import type { NextApiRequest, NextApiResponse } from 'next';

type GetCurrentUser = (req: NextApiRequest, res: NextApiResponse) => Promise<unknown>;

let getCurrentUser: GetCurrentUser;

beforeAll(async () => {
  process.env.NEON_AUTH_BASE_URL = 'http://auth.test/api/auth';
  ({ getCurrentUser } = await import('../../utils/getUser') as { getCurrentUser: GetCurrentUser });
});

const INVITE_TOKEN = 'aa11bb22-cc33-dd44-ee55-ff6677889900';

function mockReq(url: string, query: NextApiRequest['query']): NextApiRequest {
  // No session cookie — takes the first `deny` path, which is what does the logging.
  return { method: 'POST', url, query, cookies: {} } as unknown as NextApiRequest;
}

async function logLineFor(url: string, query: NextApiRequest['query']): Promise<string> {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    await getCurrentUser(mockReq(url, query), {} as NextApiResponse);
    return warn.mock.calls.map((c) => String(c[0])).join('\n');
  } finally {
    warn.mockRestore();
  }
}

describe('auth denial logging', () => {
  /**
   * The invitation token travels as a PATH segment (/api/invitations/<token>/accept), so
   * dropping the query string does not redact it — an unauthenticated call wrote a working
   * invitation link into the server log.
   */
  it('never writes an invitation token to the log', async () => {
    const line = await logLineFor(
      `/api/invitations/${INVITE_TOKEN}/accept`,
      { token: INVITE_TOKEN },
    );

    expect(line).not.toContain(INVITE_TOKEN);
    expect(line).toContain('/api/invitations/:x/accept');
  });

  it('still says which route and why, so the line stays useful', async () => {
    const line = await logLineFor('/api/articles/18/generate', { id: '18' });

    expect(line).toContain('POST');
    expect(line).toContain('/api/articles/:x/generate');
    expect(line).toContain('no session cookie');
  });

  it('masks every segment of a catch-all route', async () => {
    const line = await logLineFor(
      `/api/auth/callback/${INVITE_TOKEN}`,
      { auth0: ['callback', INVITE_TOKEN] },
    );

    expect(line).not.toContain(INVITE_TOKEN);
  });

  it('leaves a static route untouched', async () => {
    const line = await logLineFor('/api/session/bootstrap', {});
    expect(line).toContain('/api/session/bootstrap');
  });

  /**
   * `req.query` merges route params with the query string, and an unauthenticated caller
   * controls the latter — so masking every value let anyone make the log name a route
   * that was never called.
   */
  it('cannot be tricked into renaming the route from the query string', async () => {
    const line = await logLineFor('/api/articles/18/generate?x=articles&y=generate', {
      id: '18', x: 'articles', y: 'generate',
    });

    expect(line).toContain('/api/articles/:x/generate');
  });

  it('drops the query string, tokens included', async () => {
    const line = await logLineFor(`/api/invitations/accept?token=${INVITE_TOKEN}`, { token: INVITE_TOKEN });
    expect(line).not.toContain(INVITE_TOKEN);
  });
});
