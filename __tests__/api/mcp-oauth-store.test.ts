/** @jest-environment node */
/**
 * Redemption is the security-critical path of the OAuth store, and every one of its
 * guarantees has been unenforceable at some point:
 *
 *  - exactly-once, because a SELECT and an unchecked DELETE let two concurrent
 *    exchanges both read a credential and both mint tokens;
 *  - refresh-token reuse detection, because rotation deleted the row a replay
 *    would have to find in order to identify the grant to revoke;
 *  - the code itself, because the loser of a race deleted the winner's row;
 *  - the grant, because a wrong client_id consumed the token before it was compared,
 *    so anyone holding a refresh token could make the real client look like a thief.
 *
 * The fake below implements the compare-and-swap for real — an UPDATE only moves
 * `consumed_by` off NULL, a claim-scoped SELECT only matches its own claim — so the
 * tests exercise the concurrency control rather than a stub of it.
 */
type Row = Record<string, unknown> & { consumed_by: string | null };

const queries: { sql: string; replacements: unknown[] }[] = [];
let codeRow: Row | undefined;
let refreshRow: Row | undefined;

const isSelect = (sql: string) => /^\s*SELECT/i.test(sql);
const isClaimUpdate = (sql: string) => /^\s*UPDATE/i.test(sql) && sql.includes('consumed_by = ?');

/** One table's worth of compare-and-swap, shared by codes and refresh tokens. */
function serve(row: Row | undefined, sql: string, replacements: unknown[]): unknown[] {
   if (!row) return [];
   if (isClaimUpdate(sql)) {
      // WHERE ... consumed_by IS NULL — only an unclaimed row moves.
      if (row.consumed_by === null) row.consumed_by = String(replacements[0]);
      return [];
   }
   if (isSelect(sql)) {
      if (!sql.includes('consumed_by = ?')) return [row];
      // A claim-scoped read matches only the claim that won.
      const claim = replacements[replacements.length - 1];
      return row.consumed_by === claim ? [row] : [];
   }
   return [];
}

jest.mock('../../database/database', () => ({
   __esModule: true,
   default: {
      sync: jest.fn().mockResolvedValue(undefined),
      query: jest.fn((sql: string, opts?: { replacements?: unknown[] }) => {
         const replacements = opts?.replacements ?? [];
         queries.push({ sql, replacements });
         if (sql.includes('mcp_oauth_codes')) return Promise.resolve([serve(codeRow, sql, replacements), []]);
         if (sql.includes('mcp_oauth_tokens')) return Promise.resolve([serve(refreshRow, sql, replacements), []]);
         return Promise.resolve([[], []]);
      }),
   },
}));

import { redeemCode, redeemRefreshToken } from '@/src/infrastructure/mcp/oauthStore';

/** RFC 7636 appendix B. */
const VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
const CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';

const ran = (pattern: RegExp): boolean => queries.some((q) => pattern.test(q.sql));
const minted = (): number => queries.filter((q) => /INSERT INTO mcp_oauth_tokens/i.test(q.sql)).length;

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

   const stored = (consumedBy: string | null): Row => ({
      client_id: 'client-1',
      user_id: 'user-1',
      redirect_uri: 'https://claude.ai/cb',
      code_challenge: CHALLENGE,
      scope: 'mcp:tools',
      resource: null,
      expires_at: Date.now() + 60_000,
      consumed_by: consumedBy,
   });

   it('claims only an unclaimed row', async () => {
      await redeem();
      expect(ran(/UPDATE mcp_oauth_codes SET consumed_by = \? WHERE code = \? AND consumed_by IS NULL/)).toBe(true);
   });

   it('mints when it won the claim', async () => {
      codeRow = stored(null);
      expect(await redeem()).not.toBeNull();
      expect(minted()).toBe(2);
   });

   it('mints nothing when another exchange already holds the claim', async () => {
      codeRow = stored('someone-elses-claim');
      expect(await redeem()).toBeNull();
      expect(minted()).toBe(0);
   });

   it('leaves the winner\'s row alone when it loses the race', async () => {
      codeRow = stored('someone-elses-claim');
      await redeem();
      // Every delete it issues is claim-scoped, so a loser cannot burn a code the
      // winner is still exchanging.
      const deletes = queries.filter((q) => /DELETE FROM mcp_oauth_codes/i.test(q.sql));
      for (const d of deletes) expect(d.sql).toMatch(/AND consumed_by = \?/);
      expect(codeRow.consumed_by).toBe('someone-elses-claim');
   });

   it('burns its own row before validating, so a wrong verifier cannot retry', async () => {
      codeRow = stored(null);
      await redeemCode({
         code: 'the-code',
         clientId: 'client-1',
         redirectUri: 'https://claude.ai/cb',
         codeVerifier: 'wrong-verifier',
      });
      expect(ran(/DELETE FROM mcp_oauth_codes WHERE code = \? AND consumed_by = \?/)).toBe(true);
      expect(minted()).toBe(0);
   });
});

describe('refresh token rotation', () => {
   const redeem = () => redeemRefreshToken({ refreshToken: 'the-refresh', clientId: 'client-1' });

   const stored = (consumedBy: string | null): Row => ({
      client_id: 'client-1',
      user_id: 'user-1',
      scope: 'mcp:tools',
      resource: null,
      grant_id: 'grant-9',
      expires_at: Date.now() + 60_000,
      consumed_by: consumedBy,
   });

   it('rotates when it won the claim, and leaves the grant alone', async () => {
      refreshRow = stored(null);
      expect(await redeem()).not.toBeNull();
      expect(minted()).toBe(2);
      // A normal rotation must not invalidate the access token the client is using.
      expect(ran(/DELETE FROM mcp_oauth_tokens WHERE grant_id/)).toBe(false);
   });

   it('kills the whole grant when a consumed token is replayed', async () => {
      refreshRow = stored('an-earlier-claim');
      expect(await redeem()).toBeNull();
      const revoke = queries.find((q) => /DELETE FROM mcp_oauth_tokens WHERE grant_id = \?/.test(q.sql));
      expect(revoke?.replacements).toEqual(['grant-9']);
      expect(minted()).toBe(0);
   });

   it('returns null for a token that never existed', async () => {
      refreshRow = undefined;
      expect(await redeem()).toBeNull();
   });

   it('does not consume or revoke anything when the client_id is wrong', async () => {
      // The token endpoint is public: client_id comes from the request body and proves
      // nothing. Consuming on a wrong id would let anyone holding the refresh token make
      // the legitimate client's next refresh look like reuse.
      refreshRow = stored(null);
      const tokens = await redeemRefreshToken({ refreshToken: 'the-refresh', clientId: 'impostor' });
      expect(tokens).toBeNull();
      expect(ran(/UPDATE mcp_oauth_tokens SET consumed_by/)).toBe(false);
      expect(ran(/DELETE FROM mcp_oauth_tokens WHERE grant_id/)).toBe(false);
      expect(refreshRow.consumed_by).toBeNull();
   });

   it('does not consume an expired token', async () => {
      refreshRow = stored(null);
      refreshRow.expires_at = Date.now() - 1;
      expect(await redeem()).toBeNull();
      expect(ran(/UPDATE mcp_oauth_tokens SET consumed_by/)).toBe(false);
   });
});
