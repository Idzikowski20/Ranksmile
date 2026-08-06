/**
 * Local Better Auth server for dev — swaps in for Neon Auth when
 * NEON_AUTH_BASE_URL points here (see .env.local). Email+password only;
 * `[...auth0].ts` and `getUser.ts` need no logic changes since they already
 * treat NEON_AUTH_BASE_URL as an opaque base URL.
 */
import http from 'http';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import { betterAuth } from 'better-auth';
// Resolver can't follow better-auth's `exports` map; the subpaths are real at runtime.
// eslint-disable-next-line import/no-unresolved
import { toNodeHandler } from 'better-auth/node';
// eslint-disable-next-line import/no-unresolved
import { getMigrations } from 'better-auth/db/migration';
import { sendMail } from '../lib/sendMail';
import { isLocalPostgresUrl } from '../database/isLocalHost';
import { parsePgUrl, pgReady, waitUntilReady } from './lib/net';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env.development' });
dotenv.config({ path: '.env' });

const PORT = 8765;
const BASE_URL = `http://127.0.0.1:${PORT}`;

async function main(): Promise<void> {
  const databaseUrl = (process.env.DATABASE_URL || '').trim();
  if (!databaseUrl) {
    throw new Error('[dev-auth] DATABASE_URL is missing after loading .env');
  }
  // Without .env.local this falls through to .env, which on a developer machine often
  // still holds the production Neon DSN — running Better Auth's migrations against it
  // would alter live tables. A local dev auth server only ever talks to a local database.
  if (!isLocalPostgresUrl(databaseUrl)) {
    throw new Error(
      '[dev-auth] refusing to start: DATABASE_URL does not point at a local database. '
      + 'Set a localhost DSN in .env.local (this server is for local development only).',
    );
  }
  if (!process.env.BETTER_AUTH_SECRET) {
    throw new Error('[dev-auth] BETTER_AUTH_SECRET is missing after loading .env');
  }

  // The dev-postgres pane starts in parallel — without this the first migration hits a
  // connection refusal and the auth pane dies for the rest of the session.
  const { host, port } = parsePgUrl(databaseUrl);
  await waitUntilReady('dev-auth', `Postgres ${host}:${port}`, () => pgReady(databaseUrl));

  const pool = new Pool({ connectionString: databaseUrl });

  const auth = betterAuth({
    database: pool,
    baseURL: BASE_URL,
    basePath: '/api/auth',
    secret: process.env.BETTER_AUTH_SECRET,
    trustedOrigins: ['http://localhost:3000', 'http://127.0.0.1:3000'],
    emailAndPassword: {
      enabled: true,
      sendResetPassword: async ({ user, url }: { user: { email: string }; url: string }) => {
        const result = await sendMail({
          to: user.email,
          subject: 'Reset your Ranksmile password',
          html: `<p>Click below to reset your password:</p><p><a href="${url}">${url}</a></p>`,
        });
        if (!result.sent) {
          console.error('[dev-auth] sendResetPassword failed:', result.error);
        }
      },
    },
  });

  console.log('[dev-auth] running migrations…');
  const { runMigrations } = await getMigrations(auth.options);
  await runMigrations();
  console.log('[dev-auth] migrations up to date');

  const handler = toNodeHandler(auth);
  // App's proxy (pages/api/auth/[...auth0].ts) and frontend (lib/auth/fetchAuth.ts) call
  // `forget-password`, matching Neon Auth's route naming. This better-auth version renamed
  // the equivalent route to `request-password-reset` — rewrite here so prod code stays untouched.
  const server = http.createServer((req, res) => {
    if (req.url) {
      req.url = req.url.replace('/api/auth/forget-password', '/api/auth/request-password-reset');
    }
    handler(req, res).catch((err: unknown) => {
      console.error('[dev-auth] request failed:', err);
      if (!res.headersSent) res.writeHead(500);
      res.end();
    });
  });

  server.listen(PORT, '127.0.0.1', () => {
    console.log(`[dev-auth] ready at ${BASE_URL}/api/auth`);
  });

  const shutdown = () => {
    console.log('[dev-auth] shutting down…');
    server.close(() => process.exit(0));
    pool.end().catch(() => undefined);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err: unknown) => {
  console.error('[dev-auth] failed:', err);
  process.exit(1);
});
