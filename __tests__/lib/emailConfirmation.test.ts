jest.mock('../../database/database', () => ({
  __esModule: true,
  default: { query: jest.fn() },
}));

import db from '../../database/database';
import {
  hashToken,
  getConfirmationStatus,
  issueConfirmationToken,
  confirmEmailToken,
  RESEND_COOLDOWN_MS,
} from '../../lib/emailConfirmation';

const mockQuery = db.query as jest.Mock;
const rows = (r: unknown[]) => [r, {}];

describe('emailConfirmation', () => {
  beforeEach(() => mockQuery.mockReset());

  describe('hashToken', () => {
    it('produces a 64-char hex sha256 digest', () => {
      const h = hashToken('abc');
      expect(h).toMatch(/^[0-9a-f]{64}$/);
      // sha256('abc') is a well-known vector
      expect(h).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    });
  });

  describe('getConfirmationStatus', () => {
    it('returns unconfirmed/null when no row exists', async () => {
      mockQuery
        .mockResolvedValueOnce(rows([])) // CREATE TABLE
        .mockResolvedValueOnce(rows([])) // CREATE INDEX (if any) - tolerated below
        .mockResolvedValueOnce(rows([])); // SELECT
      const status = await getConfirmationStatus('user-1');
      expect(status).toEqual({ confirmed: false, email: null, lastSentMs: null });
    });

    it('returns confirmed:true for a confirmed row', async () => {
      mockQuery.mockResolvedValue(rows([{
        user_id: 'user-1', email: 'a@b.com', token_hash: null, expires_ms: null, last_sent_ms: 1000, confirmed_ms: 2000,
      }]));
      const status = await getConfirmationStatus('user-1');
      expect(status.confirmed).toBe(true);
      expect(status.email).toBe('a@b.com');
    });
  });

  describe('issueConfirmationToken', () => {
    it('returns a 64-hex raw token and stores only its sha256 hash', async () => {
      // ensureTable calls + SELECT existing row (none) + INSERT
      mockQuery.mockResolvedValue(rows([]));
      const result = await issueConfirmationToken('user-1', 'a@b.com', 1_000_000);
      expect(result.token).toMatch(/^[0-9a-f]{64}$/);

      const insertCall = mockQuery.mock.calls.find(([sql]: [string]) => /INSERT INTO email_confirmations/i.test(sql));
      expect(insertCall).toBeDefined();
      const params: unknown[] = insertCall[1]?.replacements ?? insertCall[1];
      expect(params).toContain(hashToken(result.token as string));
      expect(params).not.toContain(result.token);
    });

    it('returns cooldownMs and does not update the token when called again within 60s', async () => {
      mockQuery.mockResolvedValue(rows([{
        user_id: 'user-1', email: 'a@b.com', token_hash: 'oldhash', expires_ms: 5_000_000, last_sent_ms: 1_000_000, confirmed_ms: null,
      }]));
      const now = 1_000_000 + 30_000; // 30s later, within 60s cooldown
      const result = await issueConfirmationToken('user-1', 'a@b.com', now);
      expect(result.cooldownMs).toBeGreaterThan(0);
      expect(result.token).toBeUndefined();
      const updateOrInsert = mockQuery.mock.calls.find(([sql]: [string]) => /^(UPDATE|INSERT)/i.test(sql.trim()) && /email_confirmations/i.test(sql) && /token_hash/i.test(sql));
      expect(updateOrInsert).toBeUndefined();
    });

    it('returns alreadyConfirmed:true for an already-confirmed row, without issuing a token', async () => {
      mockQuery.mockResolvedValue(rows([{
        user_id: 'user-1', email: 'a@b.com', token_hash: null, expires_ms: null, last_sent_ms: 1_000_000, confirmed_ms: 1_500_000,
      }]));
      const result = await issueConfirmationToken('user-1', 'a@b.com', 2_000_000);
      expect(result).toEqual({ alreadyConfirmed: true });
    });
  });

  describe('confirmEmailToken', () => {
    it('returns ok:false for an unknown token', async () => {
      mockQuery.mockResolvedValue(rows([]));
      const result = await confirmEmailToken('deadbeef', 1_000_000);
      expect(result).toEqual({ ok: false });
    });

    it('returns ok:false for an expired token', async () => {
      mockQuery.mockResolvedValue(rows([{
        user_id: 'user-1', email: 'a@b.com', token_hash: hashToken('raw-token'), expires_ms: 500_000, last_sent_ms: 400_000, confirmed_ms: null,
      }]));
      const result = await confirmEmailToken('raw-token', 1_000_000); // now > expires_ms
      expect(result).toEqual({ ok: false });
    });

    it('returns ok:true and nulls token_hash/expires_ms while setting confirmed_ms for a valid token', async () => {
      const now = 1_000_000;
      mockQuery
        .mockResolvedValueOnce(rows([{
          user_id: 'user-1', email: 'a@b.com', token_hash: hashToken('raw-token'), expires_ms: 5_000_000, last_sent_ms: 400_000, confirmed_ms: null,
        }])) // SELECT by token_hash
        .mockResolvedValueOnce(rows([])) // UPDATE
        .mockResolvedValueOnce(rows([{ confirmed_ms: now }])); // post-update confirmation read
      const result = await confirmEmailToken('raw-token', now);
      expect(result).toEqual({ ok: true });

      const updateCall = mockQuery.mock.calls.find(([sql]: [string]) => /^UPDATE email_confirmations/i.test(sql.trim()));
      expect(updateCall).toBeDefined();
      const sql = String(updateCall[0]);
      expect(sql).toMatch(/token_hash\s*=\s*NULL/i);
      expect(sql).toMatch(/expires_ms\s*=\s*NULL/i);
      expect(sql).toMatch(/confirmed_ms\s*=\s*\?/i);
      // Single-use gate: the UPDATE's WHERE must re-check the hash + expiry, not just user_id.
      expect(sql).toMatch(/WHERE[\s\S]*token_hash\s*=\s*\?/i);
      expect(sql).toMatch(/expires_ms\s*>=\s*\?/i);
      const params: unknown[] = updateCall[1]?.replacements ?? updateCall[1];
      expect(params).toContain(now);
      expect(params).toContain(hashToken('raw-token'));
    });

    it('is single-use: a second sequential call with the same token returns ok:false and fires no UPDATE', async () => {
      // After the first consumption token_hash is NULL, so the SELECT by hash finds nothing.
      mockQuery.mockResolvedValue(rows([]));
      const result = await confirmEmailToken('raw-token', 1_000_000);
      expect(result).toEqual({ ok: false });
      const updateCall = mockQuery.mock.calls.find(([sql]: [string]) => /^UPDATE/i.test(String(sql).trim()));
      expect(updateCall).toBeUndefined();
    });
  });
});
