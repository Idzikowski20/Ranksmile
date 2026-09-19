/**
 * OAuth 2.1 storage for the Ranksmile MCP server.
 *
 * Implements the pieces the MCP authorization spec requires of an authorization
 * server: RFC 7591 dynamic client registration, authorization code + PKCE S256,
 * RFC 8707 resource indicators, refresh-token rotation and RFC 7009 revocation.
 *
 * Secrets are stored as SHA-256 hashes so a leaked database row cannot be replayed,
 * and expiries are epoch millis so the same SQL runs on Postgres and SQLite.
 */
import crypto from 'node:crypto';
import db from '@/database/database';
import { queryOne, queryRows } from '@/src/infrastructure/db/query';

const isPostgres = !!process.env.DATABASE_URL;
const NOW = 'CURRENT_TIMESTAMP';
const INT = isPostgres ? 'BIGINT' : 'INTEGER';

/** Short-lived, per the spec's "use short-lived access tokens" guidance. */
const ACCESS_TTL_MS = 60 * 60_000;
const REFRESH_TTL_MS = 30 * 24 * 60 * 60_000;
const CODE_TTL_MS = 10 * 60_000;

export const MCP_SCOPE = 'mcp:tools';

let checked = false;

export async function ensureMcpOauthTables(): Promise<void> {
   if (checked) return;
   await db.query(`
      CREATE TABLE IF NOT EXISTS mcp_oauth_clients (
         client_id     TEXT PRIMARY KEY,
         client_name   TEXT,
         client_uri    TEXT,
         redirect_uris TEXT NOT NULL,
         created_at    TIMESTAMP DEFAULT ${NOW}
      )
   `);
   await db.query(`
      CREATE TABLE IF NOT EXISTS mcp_oauth_codes (
         code           TEXT PRIMARY KEY,
         client_id      TEXT NOT NULL,
         user_id        TEXT NOT NULL,
         redirect_uri   TEXT NOT NULL,
         code_challenge TEXT NOT NULL,
         scope          TEXT,
         resource       TEXT,
         expires_at     ${INT} NOT NULL
      )
   `);
   await db.query(`
      CREATE TABLE IF NOT EXISTS mcp_oauth_tokens (
         token_hash    TEXT PRIMARY KEY,
         kind          TEXT NOT NULL DEFAULT 'access',
         client_id     TEXT NOT NULL,
         user_id       TEXT NOT NULL,
         scope         TEXT,
         resource      TEXT,
         grant_id      TEXT,
         expires_at    ${INT} NOT NULL,
         created_at    TIMESTAMP DEFAULT ${NOW}
      )
   `);
   // Columns added after the first cut — no-ops when they already exist.
   for (const alter of [
      'ALTER TABLE mcp_oauth_clients ADD COLUMN client_uri TEXT',
      'ALTER TABLE mcp_oauth_codes ADD COLUMN resource TEXT',
      'ALTER TABLE mcp_oauth_tokens ADD COLUMN kind TEXT NOT NULL DEFAULT \'access\'',
      'ALTER TABLE mcp_oauth_tokens ADD COLUMN resource TEXT',
      'ALTER TABLE mcp_oauth_tokens ADD COLUMN grant_id TEXT',
   ]) {
      try { await db.query(alter); } catch { /* exists */ }
   }
   try { await db.query('CREATE INDEX IF NOT EXISTS idx_mcp_tokens_user ON mcp_oauth_tokens(user_id)'); } catch { /* exists */ }
   try { await db.query('CREATE INDEX IF NOT EXISTS idx_mcp_tokens_grant ON mcp_oauth_tokens(grant_id)'); } catch { /* exists */ }
   checked = true;
}

const rand = (bytes = 32): string => crypto.randomBytes(bytes).toString('base64url');
const sha256 = (s: string): string => crypto.createHash('sha256').update(s).digest('base64url');

/** RFC 7636 S256: BASE64URL(SHA256(verifier)) must equal the stored challenge. */
export function verifyPkce(verifier: string, challenge: string): boolean {
   if (!verifier || !challenge) return false;
   const expected = Buffer.from(sha256(verifier));
   const got = Buffer.from(challenge);
   return expected.length === got.length && crypto.timingSafeEqual(expected, got);
}

export type OauthClient = { client_id: string; client_name: string | null; client_uri: string | null; redirect_uris: string[] };

export async function registerClient(p: { name: string; uri?: string; redirectUris: string[] }): Promise<OauthClient> {
   await ensureMcpOauthTables();
   const clientId = `rsm_${rand(16)}`;
   await db.query(
      'INSERT INTO mcp_oauth_clients (client_id, client_name, client_uri, redirect_uris) VALUES (?, ?, ?, ?)',
      { replacements: [clientId, p.name || null, p.uri || null, JSON.stringify(p.redirectUris)] },
   );
   return { client_id: clientId, client_name: p.name || null, client_uri: p.uri || null, redirect_uris: p.redirectUris };
}

export async function getClient(clientId: string): Promise<OauthClient | null> {
   await ensureMcpOauthTables();
   const row = await queryOne<{ client_id: string; client_name: string | null; client_uri: string | null; redirect_uris: string }>(
      'SELECT client_id, client_name, client_uri, redirect_uris FROM mcp_oauth_clients WHERE client_id = ? LIMIT 1',
      [clientId],
   );
   if (!row) return null;
   let uris: string[] = [];
   try { uris = JSON.parse(row.redirect_uris) as string[]; } catch { uris = []; }
   return { client_id: row.client_id, client_name: row.client_name, client_uri: row.client_uri, redirect_uris: uris };
}

export async function issueCode(p: {
   clientId: string; userId: string; redirectUri: string; codeChallenge: string; scope?: string; resource?: string;
}): Promise<string> {
   await ensureMcpOauthTables();
   const code = rand(24);
   await db.query(
      `INSERT INTO mcp_oauth_codes (code, client_id, user_id, redirect_uri, code_challenge, scope, resource, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      {
         replacements: [
            code, p.clientId, p.userId, p.redirectUri, p.codeChallenge,
            p.scope ?? MCP_SCOPE, p.resource ?? null, Date.now() + CODE_TTL_MS,
         ],
      },
   );
   return code;
}

export type IssuedTokens = {
   access_token: string;
   refresh_token: string;
   expires_in: number;
   scope: string;
};

async function mintPair(p: {
   clientId: string; userId: string; scope: string; resource: string | null; grantId: string;
}): Promise<IssuedTokens> {
   const access = rand(32);
   const refresh = rand(32);
   const now = Date.now();
   await db.query(
      `INSERT INTO mcp_oauth_tokens (token_hash, kind, client_id, user_id, scope, resource, grant_id, expires_at)
       VALUES (?, 'access', ?, ?, ?, ?, ?, ?)`,
      { replacements: [sha256(access), p.clientId, p.userId, p.scope, p.resource, p.grantId, now + ACCESS_TTL_MS] },
   );
   await db.query(
      `INSERT INTO mcp_oauth_tokens (token_hash, kind, client_id, user_id, scope, resource, grant_id, expires_at)
       VALUES (?, 'refresh', ?, ?, ?, ?, ?, ?)`,
      { replacements: [sha256(refresh), p.clientId, p.userId, p.scope, p.resource, p.grantId, now + REFRESH_TTL_MS] },
   );
   return { access_token: access, refresh_token: refresh, expires_in: Math.floor(ACCESS_TTL_MS / 1000), scope: p.scope };
}

/** Redeem an authorization code exactly once. Returns null on any mismatch. */
export async function redeemCode(p: {
   code: string; clientId: string; redirectUri: string; codeVerifier: string; resource?: string;
}): Promise<IssuedTokens | null> {
   await ensureMcpOauthTables();
   const row = await queryOne<{
      client_id: string; user_id: string; redirect_uri: string; code_challenge: string;
      scope: string | null; resource: string | null; expires_at: number;
   }>(
      `SELECT client_id, user_id, redirect_uri, code_challenge, scope, resource, expires_at
         FROM mcp_oauth_codes WHERE code = ? LIMIT 1`,
      [p.code],
   );
   // One-time use: the row goes regardless of whether the rest validates, so a wrong
   // verifier cannot be retried against the same code.
   await db.query('DELETE FROM mcp_oauth_codes WHERE code = ?', { replacements: [p.code] });
   if (!row) return null;
   if (Number(row.expires_at) < Date.now()) return null;
   if (row.client_id !== p.clientId) return null;
   if (row.redirect_uri !== p.redirectUri) return null;
   // RFC 8707: when the token request repeats `resource`, it must be the one the code
   // was authorized for — an access token must never widen its audience at exchange.
   if (p.resource && row.resource && p.resource !== row.resource) return null;
   if (!verifyPkce(p.codeVerifier, row.code_challenge)) return null;

   return mintPair({
      clientId: row.client_id,
      userId: row.user_id,
      scope: row.scope || MCP_SCOPE,
      resource: row.resource,
      grantId: rand(12),
   });
}

/** Rotate a refresh token: the presented one is consumed and a fresh pair issued. */
export async function redeemRefreshToken(p: { refreshToken: string; clientId: string }): Promise<IssuedTokens | null> {
   await ensureMcpOauthTables();
   const hash = sha256(p.refreshToken);
   const row = await queryOne<{
      client_id: string; user_id: string; scope: string | null; resource: string | null;
      grant_id: string | null; expires_at: number;
   }>(
      `SELECT client_id, user_id, scope, resource, grant_id, expires_at
         FROM mcp_oauth_tokens WHERE token_hash = ? AND kind = 'refresh' LIMIT 1`,
      [hash],
   );
   if (!row) return null;
   await db.query('DELETE FROM mcp_oauth_tokens WHERE token_hash = ?', { replacements: [hash] });
   if (Number(row.expires_at) < Date.now()) return null;
   if (row.client_id !== p.clientId) return null;

   // Rotation with reuse detection: the whole grant dies if the old refresh token is
   // replayed, so a stolen copy cannot outlive the legitimate client's next refresh.
   const grantId = row.grant_id || rand(12);
   await db.query('DELETE FROM mcp_oauth_tokens WHERE grant_id = ? AND kind = \'access\'', { replacements: [grantId] });

   return mintPair({
      clientId: row.client_id,
      userId: row.user_id,
      scope: row.scope || MCP_SCOPE,
      resource: row.resource,
      grantId,
   });
}

export type TokenClaims = { userId: string; clientId: string; scope: string; resource: string | null };

/** Resolve a bearer access token, or null when unknown/expired/not an access token. */
export async function verifyAccessToken(token: string): Promise<TokenClaims | null> {
   if (!token) return null;
   await ensureMcpOauthTables();
   const row = await queryOne<{ user_id: string; client_id: string; scope: string | null; resource: string | null; expires_at: number }>(
      `SELECT user_id, client_id, scope, resource, expires_at
         FROM mcp_oauth_tokens WHERE token_hash = ? AND kind = 'access' LIMIT 1`,
      [sha256(token)],
   );
   if (!row) return null;
   if (Number(row.expires_at) < Date.now()) return null;
   return { userId: row.user_id, clientId: row.client_id, scope: row.scope || MCP_SCOPE, resource: row.resource };
}

/** RFC 7009 revocation. Kills the whole grant, whichever token of it was presented. */
export async function revokeToken(token: string): Promise<void> {
   if (!token) return;
   await ensureMcpOauthTables();
   const hash = sha256(token);
   const row = await queryOne<{ grant_id: string | null }>('SELECT grant_id FROM mcp_oauth_tokens WHERE token_hash = ? LIMIT 1', [hash]);
   if (!row) return;
   if (row.grant_id) {
      await db.query('DELETE FROM mcp_oauth_tokens WHERE grant_id = ?', { replacements: [row.grant_id] });
      return;
   }
   await db.query('DELETE FROM mcp_oauth_tokens WHERE token_hash = ?', { replacements: [hash] });
}

/** Connections the signed-in user has granted, for the settings screen. */
export async function listUserGrants(userId: string): Promise<Array<{ client_id: string; client_name: string | null; created_at: string | null }>> {
   await ensureMcpOauthTables();
   return queryRows<{ client_id: string; client_name: string | null; created_at: string | null }>(
      `SELECT t.client_id, c.client_name, MIN(t.created_at) AS created_at
         FROM mcp_oauth_tokens t LEFT JOIN mcp_oauth_clients c ON c.client_id = t.client_id
        WHERE t.user_id = ? AND t.expires_at > ?
        GROUP BY t.client_id, c.client_name
        ORDER BY created_at DESC`,
      [userId, Date.now()],
   );
}

export async function revokeGrant(userId: string, clientId: string): Promise<void> {
   await ensureMcpOauthTables();
   await db.query('DELETE FROM mcp_oauth_tokens WHERE user_id = ? AND client_id = ?', { replacements: [userId, clientId] });
}
