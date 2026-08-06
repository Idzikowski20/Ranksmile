import 'reflect-metadata';
import { Sequelize } from 'sequelize-typescript';
import Domain from './models/domain';
import Keyword from './models/keyword';
import GscAccount from './models/gscAccount';
import ArticleKeyword from './models/articleKeyword';

const { DATABASE_URL } = process.env;

const MODELS = [Domain, Keyword, GscAccount, ArticleKeyword];

function isLocalHost(url: string): boolean {
   try {
      const { hostname } = new URL(url);
      return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
   } catch {
      return false;
   }
}

function createConnection(): Sequelize {
   if (DATABASE_URL) {
      // Neon PostgreSQL (or local Postgres — see isLocalHost below).
      // Pass `pg` explicitly: Sequelize loads the dialect via a dynamic require, which
      // Next.js' serverless dependency tracer can't see — so `pg` is left out of the
      // Vercel function bundle and the runtime throws "Please install pg package manually".
      // A static require here makes the tracer include it (mirrors the sqlite3 branch below).
      // eslint-disable-next-line global-require
      const pg = require('pg');
      return new Sequelize(DATABASE_URL, {
         dialect: 'postgres',
         dialectModule: pg,
         // Local Postgres (docker/embedded dev DB) has no SSL cert — only Neon needs this.
         dialectOptions: isLocalHost(DATABASE_URL) ? {} : {
            ssl: {
               require: true,
               rejectUnauthorized: false,
            },
         },
         // Neon cold-start + DNS blips: default acquire is too tight under pool pressure
         // (email-outbox / pipeline-workers then log ConnectionAcquireTimeoutError).
         pool: {
            max: 5, min: 0, idle: 10000, acquire: 60000, evict: 10000,
         },
         logging: false,
         models: MODELS,
      });
   }

   // Fallback SQLite (dev bez DATABASE_URL)
   // eslint-disable-next-line global-require
   const sqlite3 = require('sqlite3');
   return new Sequelize({
      dialect: 'sqlite',
      host: '0.0.0.0',
      username: process.env.USER_NAME ? process.env.USER_NAME : process.env.USER,
      password: process.env.PASSWORD,
      database: 'sequelize',
      dialectModule: sqlite3,
      pool: { max: 5, min: 0, idle: 10000 },
      logging: false,
      models: MODELS,
      storage: './data/database.sqlite',
   });
}

const connection: Sequelize = createConnection();

// Memoize the no-arg sync: every API route calls `await db.sync()`, but the schema only needs
// creating once per process. Without this each request pays a metadata round-trip per model.
// (Calls WITH options — e.g. {alter}/{force} — still run through untouched.)
let syncPromise: Promise<unknown> | null = null;
const originalSync = connection.sync.bind(connection);
(connection as unknown as { sync: typeof connection.sync }).sync = ((options?: Parameters<typeof connection.sync>[0]) => {
   if (options) return originalSync(options);
   if (!syncPromise) syncPromise = originalSync();
   return syncPromise;
}) as typeof connection.sync;

export default connection;
