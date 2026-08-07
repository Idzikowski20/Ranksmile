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
import { Client } from 'pg';
// Resolver can't follow the package's `exports` map; the shim in types.d.ts types it.
// eslint-disable-next-line import/no-unresolved
import EmbeddedPostgres from 'embedded-postgres';
import {
  parsePgUrl, tcpOpen, pgReady, heartbeat,
} from './lib/net';

type PgTarget = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
};

/**
 * The app stores SERP results, LLM output and scraped pages — text that routinely
 * carries characters outside any single-byte codepage. `initdb` inherits the OS
 * locale, so on a Polish Windows the cluster (and every database created from
 * template1) lands on WIN1250 and those INSERTs die with
 * `character with byte sequence 0x.. has no equivalent in encoding "WIN1250"`,
 * failing analysis jobs halfway. template0 lets a UTF8 database live in such a
 * cluster, so create ours explicitly and refuse to run against a non-UTF8 one.
 */
async function ensureUtf8Database(target: PgTarget): Promise<void> {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(target.database)) {
    throw new Error(`[dev-postgres] unsupported database name: ${target.database}`);
  }
  const admin = new Client({
    host: target.host,
    port: target.port,
    user: target.user,
    password: target.password,
    database: 'postgres',
  });
  await admin.connect();
  try {
    let existing = await admin.query<{ enc: string }>(
      'SELECT pg_encoding_to_char(encoding) AS enc FROM pg_database WHERE datname = $1',
      [target.database],
    );
    if (!existing.rows.length) {
      try {
        await admin.query(
          `CREATE DATABASE "${target.database}" WITH ENCODING 'UTF8' TEMPLATE template0 LC_COLLATE 'C' LC_CTYPE 'C'`,
        );
        console.log(`[dev-postgres] created database ${target.database} (UTF8)`);
        return;
      } catch (err) {
        // The check above and this CREATE aren't atomic, so a second dev-postgres.ts
        // process (stale pane from a previous session, restarted pane racing the old one)
        // can create it between our SELECT and our CREATE. Verified against a real
        // concurrent race (two clients racing this exact query): Postgres reports it as
        // 23505 (unique_violation on the pg_database catalog index), not the friendlier
        // 42P04 (duplicate_database) you'd get from a serial "it already existed" call —
        // catch both. Not a real failure — re-fetch below to verify what the winner made.
        const { code } = err as { code?: string };
        if (code !== '42P04' && code !== '23505') throw err;
        existing = await admin.query<{ enc: string }>(
          'SELECT pg_encoding_to_char(encoding) AS enc FROM pg_database WHERE datname = $1',
          [target.database],
        );
      }
    }
    const encoding = existing.rows[0].enc;
    if (encoding !== 'UTF8') {
      throw new Error(
        `[dev-postgres] database "${target.database}" is ${encoding}, not UTF8 — analysis jobs will fail on any\n`
        + 'character outside that codepage. Recreate it (dev data is disposable):\n'
        + `  psql -h ${target.host} -p ${target.port} -U ${target.user} -d postgres `
        + `-c 'DROP DATABASE "${target.database}"'\n`
        + 'then restart this pane, which recreates it as UTF8.',
      );
    }
  } finally {
    await admin.end().catch(() => {});
  }
}

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
    await ensureUtf8Database({
      host, port, user, password, database,
    });
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
  await ensureUtf8Database({
    host, port, user, password, database,
  });
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
