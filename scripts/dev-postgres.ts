/**
 * Ensure Postgres on DATABASE_URL host:port for local mprocs.
 * If nothing listens — start an embedded Postgres cluster (data persisted under
 * .local-postgres) and keep it alive.
 * If Postgres already exists (docker, native install, previous run) — stay UP
 * with a heartbeat (do not start a second instance).
 *
 * DATABASE_URL is required: every sibling pane reads it too, and a private default
 * here would leave this pane green while Sequelize silently fell back to SQLite.
 */
import path from 'path';
import { existsSync } from 'fs';
import dotenv from 'dotenv';
// Resolver can't follow the package's `exports` map; the shim in types.d.ts types it.
// eslint-disable-next-line import/no-unresolved
import EmbeddedPostgres from 'embedded-postgres';
import {
  parsePgUrl, tcpOpen, pgReady, heartbeat,
} from './lib/net';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env.development' });
dotenv.config({ path: '.env' });

async function main(): Promise<void> {
  const url = (process.env.DATABASE_URL || '').trim();
  if (!url) {
    throw new Error(
      '[dev-postgres] DATABASE_URL is missing after loading .env — set it (e.g. '
      + 'postgresql://ranksmile:ranksmile@127.0.0.1:5432/ranksmile) so every dev pane targets the same database',
    );
  }
  // Throws on a malformed DSN — better than starting a cluster the rest of the stack can't reach.
  const {
    host, port, user, password, database,
  } = parsePgUrl(url);

  if (await tcpOpen(host, port)) {
    if (!await pgReady(url)) {
      throw new Error(
        `[dev-postgres] something is listening on ${host}:${port} but it does not answer as the Postgres in `
        + 'DATABASE_URL — stop the conflicting service or fix the credentials/database name',
      );
    }
    console.log(`[dev-postgres] using existing Postgres at ${host}:${port}`);
    await heartbeat('dev-postgres', () => pgReady(url));
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
