/** @jest-environment node */
/**
 * Redemption is the security-critical path of the OAuth store, and both of its
 * guarantees used to be unenforceable:
 *
 *  - exactly-once, because a SELECT and an unchecked DELETE let two concurrent
 *    exchanges both read a credential and both mint tokens;
 *  - refresh-token reuse detection, because rotation deleted the row a replay
 *    would have to find in order to identify the grant to revoke.
 *
 * These tests drive the store through a fake `db.query` that dispatches on SQL,
 * so the compare-and-swap and the tombstone are asserted rather than assumed.
 */
const queries: { sql: string; replacements: unknown[] }[] = [];
let codeRow: Record<string, unknown> | undefined;
let refreshRow: Record<string, unknown> | undefined;

jest.mock('../../database/database', () => ({
  __esModule: true,
  default: {
    sync: jest.fn().mockResolvedValue(undefined),
    query: jest.fn((sql: string, opts?: { replacements?: unknown[] }) => {
      queries.push({ sql, replacements: opts?.replacements ?? [] });
      if (/^\s*SELECT/i.test(sql) && sql.includes('mcp_oauth_codes')) {
        return Promise.resolve([codeRow ? [codeRow] : [], []]);
      }
      if (/^\s*SELECT/i.test(sql) && sql.includes('mcp_oauth_tokens')) {
        return Promise.resolve([refreshRow ? [refreshRow] : [], []]);
      }
      return Promise.resolve([[], []]);
    }),
  },
}));

import { redeemCode, redeemRefreshToken } from '@/src/infrastructure/mcp/oauthStore';

/** RFC 7636 appendix B. */
const VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
const CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';

const claimOf = (table: string): string => {
  const update = queries.find((q) => /^\s*UPDATE/i.test(q.sql) && q.sql.includes(table));
  return String(update?.replacements[0] ?? '');
};

const ran = (pattern: RegExp): boolean => queries.some((q) => pattern.test(q.sql));

beforeEach(() => {
  queries.length = 0;
  codeRow = undefined;
  refreshRow = undefined;
});

describe('authorization code redemption', () => {
  const redeem = () =>
    redeemCode({
      code: 'the-code',
      clientId: 'client-1',
      redirectUri: 'https://claude.ai/cb',
      codeVerifier: VERIFIER,
    });

  const validRow = (consumedBy: string) => ({
    client_id: 'client-1',
    user_id: 'user-1',
    redirect_uri: 'https://claude.ai/cb',
    code_challenge: CHALLENGE,
    scope: 'mcp:tools',
    resource: null,
    expires_at: Date.now() + 60_000,
    consumed_by: consumedBy,
  });

  it('claims the row before reading it, and only where it is unclaimed', async () => {
    codeRow = undefined;
    await redeem();
    expect(
      ran(/UPDATE mcp_oauth_codes SET consumed_by = \? WHERE code = \? AND consumed_by IS NULL/)
    ).toBe(true);
  });

  it('mints when it won the claim', async () => {
    // The fake returns whatever the UPDATE wrote, which is what winning looks like.
    const pending = redeem();
    await Promise.resolve();
    codeRow = validRow(claimOf('mcp_oauth_codes'));
    const tokens = await pending;
    expect(tokens).not.toBeNull();
    expect(queries.filter((q) => /INSERT INTO mcp_oauth_tokens/i.test(q.sql))).toHaveLength(2);
  });

  it('mints nothing when another exchange won the claim', async () => {
    codeRow = validRow('someone-elses-claim');
    const tokens = await redeem();
    expect(tokens).toBeNull();
    expect(ran(/INSERT INTO mcp_oauth_tokens/i)).toBe(false);
  });
});

describe('refresh token rotation', () => {
  const redeem = () => redeemRefreshToken({ refreshToken: 'the-refresh', clientId: 'client-1' });

  const row = (consumedBy: string | null) => ({
    client_id: 'client-1',
    user_id: 'user-1',
    scope: 'mcp:tools',
    resource: null,
    grant_id: 'grant-9',
    expires_at: Date.now() + 60_000,
    consumed_by: consumedBy,
  });

  it('rotates when it won the claim, and leaves the grant alone', async () => {
    const pending = redeem();
    await Promise.resolve();
    refreshRow = row(claimOf('mcp_oauth_tokens'));
    const tokens = await pending;
    expect(tokens).not.toBeNull();
    expect(ran(/DELETE FROM mcp_oauth_tokens WHERE grant_id/)).toBe(false);
  });

  it('kills the whole grant when a consumed token is replayed', async () => {
    refreshRow = row('an-earlier-claim');
    const tokens = await redeem();
    expect(tokens).toBeNull();
    const revoke = queries.find((q) => /DELETE FROM mcp_oauth_tokens WHERE grant_id = \?/.test(q.sql));
    expect(revoke?.replacements).toEqual(['grant-9']);
    expect(ran(/INSERT INTO mcp_oauth_tokens/i)).toBe(false);
  });

  it('returns null for a token that never existed', async () => {
    refreshRow = undefined;
    expect(await redeem()).toBeNull();
  });
});
