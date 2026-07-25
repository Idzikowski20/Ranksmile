import crypto from 'crypto';
import db from '../database/database';
import { queryOne } from './db/query';

const isPostgres = !!process.env.DATABASE_URL;

// App-owned email verification. Kept out of NextAuth's user table since email confirmation is a
// Ranksmile-specific gate (not every auth provider needs it), and this way it can be added/removed
// without touching the NextAuth schema. token_hash/expires_ms/confirmed_ms mirror the aiTokenUsage
// idiom: epoch-ms integers, no timezone pitfalls across Postgres/SQLite.
// 30 min — matches the confirmation e-mail's "self-destruct in 30 minutes" copy (Ranksmile parity).
export const TOKEN_TTL_MS = 30 * 60 * 1000;
export const RESEND_COOLDOWN_MS = 60_000;

let ready: Promise<void> | null = null;
export function ensureEmailConfirmationsTable(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      await db.query(`CREATE TABLE IF NOT EXISTS email_confirmations (
        user_id      TEXT PRIMARY KEY,
        email        TEXT NOT NULL,
        token_hash   TEXT,
        expires_ms   BIGINT,
        last_sent_ms BIGINT,
        confirmed_ms BIGINT
      )`);
    })().catch((e) => { ready = null; throw e; });
  }
  return ready;
}

export const hashToken = (raw: string): string => crypto.createHash('sha256').update(raw).digest('hex');

export interface ConfirmationStatus { confirmed: boolean; email: string | null; lastSentMs: number | null; }

interface EmailConfirmationRow {
  user_id: string;
  email: string;
  token_hash: string | null;
  expires_ms: number | string | null;
  last_sent_ms: number | string | null;
  confirmed_ms: number | string | null;
}

const EMAIL_CONFIRMATION_COLS = 'user_id, email, token_hash, expires_ms, last_sent_ms, confirmed_ms';

const getRow = (userId: string) => queryOne<EmailConfirmationRow>(
  `SELECT ${EMAIL_CONFIRMATION_COLS} FROM email_confirmations WHERE user_id = ?`,
  [userId],
);

/** No row → { confirmed:false, email:null, lastSentMs:null }. */
export async function getConfirmationStatus(userId: string): Promise<ConfirmationStatus> {
  await ensureEmailConfirmationsTable();
  const row = await getRow(userId);
  if (!row) return { confirmed: false, email: null, lastSentMs: null };
  return {
    confirmed: !!row.confirmed_ms,
    email: row.email,
    lastSentMs: row.last_sent_ms === null ? null : Number(row.last_sent_ms),
  };
}

/** Upsert a fresh token for the user. Returns { token } (RAW — caller emails it) or
 *  { cooldownMs } when called again within RESEND_COOLDOWN_MS of last_sent_ms.
 *  Already-confirmed users → { alreadyConfirmed: true } (no token, no email). */
export async function issueConfirmationToken(userId: string, email: string, now: number = Date.now()):
  Promise<{ token?: string; cooldownMs?: number; alreadyConfirmed?: boolean }> {
  await ensureEmailConfirmationsTable();
  const existing = await getRow(userId);

  if (existing?.confirmed_ms) return { alreadyConfirmed: true };

  if (existing?.last_sent_ms !== null && existing?.last_sent_ms !== undefined) {
    const elapsed = now - Number(existing.last_sent_ms);
    if (elapsed < RESEND_COOLDOWN_MS) return { cooldownMs: RESEND_COOLDOWN_MS - elapsed };
  }

  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);
  const expiresMs = now + TOKEN_TTL_MS;

  // Atomic upsert on the user_id PRIMARY KEY so concurrent resend/initial-send requests can't both
  // pass a SELECT and then race into duplicate INSERTs (PK violation → server error). Unconfirmed
  // users only reach here (confirmed → early-returned above), so overwriting confirmed_ms=NULL is safe.
  if (isPostgres) {
    await db.query(
      `INSERT INTO email_confirmations (user_id, email, token_hash, expires_ms, last_sent_ms, confirmed_ms)
       VALUES (?, ?, ?, ?, ?, NULL)
       ON CONFLICT (user_id) DO UPDATE SET
         email = EXCLUDED.email,
         token_hash = EXCLUDED.token_hash,
         expires_ms = EXCLUDED.expires_ms,
         last_sent_ms = EXCLUDED.last_sent_ms`,
      { replacements: [userId, email, tokenHash, expiresMs, now] },
    );
  } else {
    await db.query(
      `INSERT OR REPLACE INTO email_confirmations (user_id, email, token_hash, expires_ms, last_sent_ms, confirmed_ms)
       VALUES (?, ?, ?, ?, ?, NULL)`,
      { replacements: [userId, email, tokenHash, expiresMs, now] },
    );
  }

  return { token };
}

/** Single-use verify: find row by token_hash; expired/missing → { ok:false }.
 *  Valid → set confirmed_ms = now, NULL token_hash/expires_ms, return { ok:true }.
 *  The UPDATE itself is the single-use gate (WHERE re-checks token_hash + expiry), so a second
 *  consumer of the same token cannot re-match once the hash is nulled; sequelize's raw-query
 *  affected-row metadata is dialect-inconsistent, so `ok` is confirmed by re-reading the row. */
export async function confirmEmailToken(rawToken: string, now: number = Date.now()): Promise<{ ok: boolean }> {
  await ensureEmailConfirmationsTable();
  const tokenHash = hashToken(rawToken);
  const row = await queryOne<EmailConfirmationRow>(
    `SELECT ${EMAIL_CONFIRMATION_COLS} FROM email_confirmations WHERE token_hash = ?`,
    [tokenHash],
  );
  if (!row || row.expires_ms === null || Number(row.expires_ms) < now) return { ok: false };

  await db.query(
    'UPDATE email_confirmations SET token_hash = NULL, expires_ms = NULL, confirmed_ms = ? WHERE user_id = ? AND token_hash = ? AND expires_ms >= ?',
    { replacements: [now, row.user_id, tokenHash, now] },
  );
  const after = await queryOne<{ confirmed_ms: number | string | null }>(
    'SELECT confirmed_ms FROM email_confirmations WHERE user_id = ? AND token_hash IS NULL',
    [row.user_id],
  );
  return { ok: !!after?.confirmed_ms };
}
