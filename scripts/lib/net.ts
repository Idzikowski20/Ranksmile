/**
 * DSN parsing and readiness probes shared by the local dev panes (mprocs).
 *
 * One copy so the timeouts, IPv6 handling and "is it really up?" semantics can't
 * drift between dev-postgres, dev-redis and pipeline-workers.
 */
import net from 'net';
import { Client } from 'pg';

/**
 * WHATWG `URL` keeps the brackets on IPv6 hosts (`new URL('…@[::1]:5432/db').hostname`
 * is `"[::1]"`), which neither `net.createConnection` nor pg accepts — strip them.
 */
export function normalizeHost(hostname: string): string {
  return hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;
}

export type PgTarget = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
};

/** Throws on a malformed DSN — a bad value must fail loudly, never fall back to a default. */
export function parsePgUrl(raw: string): PgTarget {
  const u = new URL(raw);
  return {
    host: normalizeHost(u.hostname) || '127.0.0.1',
    port: u.port ? Number(u.port) : 5432,
    user: decodeURIComponent(u.username) || 'ranksmile',
    password: decodeURIComponent(u.password) || 'ranksmile',
    database: u.pathname.replace(/^\//, '') || 'ranksmile',
  };
}

/** Throws on a malformed DSN — see `parsePgUrl`. */
export function parseRedisUrl(raw: string): { host: string; port: number } {
  const u = new URL(raw);
  return { host: normalizeHost(u.hostname) || '127.0.0.1', port: u.port ? Number(u.port) : 6379 };
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => { setTimeout(resolve, ms); });
}

/** Something is listening. Says nothing about *what* — see `pgReady` for Postgres. */
export function tcpOpen(host: string, port: number, timeoutMs = 800): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    const done = (ok: boolean) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
  });
}

/**
 * True only when Postgres itself answers `SELECT 1` with these credentials.
 * An unrelated listener on 5432 (or a cluster still replaying WAL) is not "ready" —
 * accepting one leaves the pane green while Sequelize and auth fail to connect.
 */
export async function pgReady(url: string, timeoutMs = 3000): Promise<boolean> {
  const client = new Client({ connectionString: url, connectionTimeoutMillis: timeoutMs });
  try {
    await client.connect();
    await client.query('SELECT 1');
    return true;
  } catch {
    return false;
  } finally {
    await client.end().catch(() => undefined);
  }
}

/** Poll `check` until it passes; throws once `maxMs` elapses. */
export async function waitUntilReady(
  label: string,
  what: string,
  check: () => Promise<boolean>,
  maxMs = 60_000,
): Promise<void> {
  const started = Date.now();
  for (;;) {
    if (await check()) {
      console.log(`[${label}] ${what} ready`);
      return;
    }
    if (Date.now() - started >= maxMs) {
      throw new Error(`${what} not reachable within ${maxMs}ms`);
    }
    console.log(`[${label}] waiting for ${what}…`);
    await sleep(1500);
  }
}

/** Keeps a pane alive while its service stays reachable; exits non-zero the moment it isn't. */
export async function heartbeat(
  label: string,
  check: () => Promise<boolean>,
  intervalMs = 5000,
): Promise<never> {
  for (;;) {
    if (!await check()) {
      console.error(`[${label}] lost connection`);
      process.exit(1);
    }
    await sleep(intervalMs);
  }
}
