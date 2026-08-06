/**
 * Ensure Postgres on DATABASE_URL host:port (default 127.0.0.1:5432) for local mprocs.
 * If nothing listens — start an embedded Postgres cluster (data persisted under
 * .local-postgres) and keep it alive.
 * If Postgres already exists (docker, native install, previous run) — stay UP
 * with a heartbeat (do not start a second instance).
 */
import net from 'net';
import path from 'path';
import { existsSync } from 'fs';
import dotenv from 'dotenv';
// Resolver can't follow the package's `exports` map; the shim in types.d.ts types it.
// eslint-disable-next-line import/no-unresolved
import EmbeddedPostgres from 'embedded-postgres';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env.development' });
dotenv.config({ path: '.env' });

const DEFAULT_URL = 'postgresql://ranksmile:ranksmile@127.0.0.1:5432/ranksmile';

function parsePgUrl(raw: string): { host: string; port: number; user: string; password: string; database: string } {
  try {
    const u = new URL(raw);
    return {
      host: u.hostname || '127.0.0.1',
      port: u.port ? Number(u.port) : 5432,
      user: decodeURIComponent(u.username) || 'ranksmile',
      password: decodeURIComponent(u.password) || 'ranksmile',
      database: u.pathname.replace(/^\//, '') || 'ranksmile',
    };
  } catch {
    return { host: '127.0.0.1', port: 5432, user: 'ranksmile', password: 'ranksmile', database: 'ranksmile' };
  }
}

function tcpOpen(host: string, port: number, timeoutMs = 800): Promise<boolean> {
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

async function heartbeat(host: string, port: number): Promise<never> {
  console.log(`[dev-postgres] using existing Postgres at ${host}:${port}`);
  for (;;) {
    const ok = await tcpOpen(host, port, 1500);
    if (!ok) {
      console.error(`[dev-postgres] lost connection to ${host}:${port}`);
      process.exit(1);
    }
    await new Promise((resolve) => { setTimeout(resolve, 5000); });
  }
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL || DEFAULT_URL;
  const { host, port, user, password, database } = parsePgUrl(url);

  if (await tcpOpen(host, port)) {
    await heartbeat(host, port);
    return;
  }

  console.log(`[dev-postgres] nothing on ${host}:${port} — starting embedded Postgres…`);
  const pg = new EmbeddedPostgres({
    databaseDir: path.join('.local-postgres'),
    port,
    user,
    password,
    persistent: true,
    onLog: (message) => console.log(`[dev-postgres] ${message}`),
    onError: (message) => console.error(`[dev-postgres] ${message}`),
  });

  if (!existsSync(path.join('.local-postgres', 'PG_VERSION'))) {
    await pg.initialise();
  }
  await pg.start();
  try {
    await pg.createDatabase(database);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!/already exists/i.test(msg)) throw err;
  }
  console.log(`[dev-postgres] ready at postgresql://${user}:***@${host}:${port}/${database}`);

  const shutdown = async () => {
    console.log('[dev-postgres] shutting down…');
    await pg.stop();
    process.exit(0);
  };
  const onSignal = () => { shutdown().catch(() => process.exit(1)); };
  process.on('SIGINT', onSignal);
  process.on('SIGTERM', onSignal);

  // Keep process alive
  await new Promise(() => {});
}

main().catch((err: unknown) => {
  console.error('[dev-postgres] failed:', err);
  process.exit(1);
});
