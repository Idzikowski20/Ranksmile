import { Sequelize } from 'sequelize-typescript';
import Domain from './models/domain';
import Keyword from './models/keyword';
import GscAccount from './models/gscAccount';
import ArticleKeyword from './models/articleKeyword';

const DATABASE_URL = process.env.DATABASE_URL;

let connection: Sequelize;

if (DATABASE_URL) {
   // Neon PostgreSQL.
   // Pass `pg` explicitly: Sequelize loads the dialect via a dynamic require, which
   // Next.js' serverless dependency tracer can't see — so `pg` is left out of the
   // Vercel function bundle and the runtime throws "Please install pg package manually".
   // A static require here makes the tracer include it (mirrors the sqlite3 branch below).
   // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
   const pg = require('pg');
   connection = new Sequelize(DATABASE_URL, {
      dialect: 'postgres',
      dialectModule: pg,
      dialectOptions: {
         ssl: {
            require: true,
            rejectUnauthorized: false,
         },
      },
      pool: { max: 5, min: 0, idle: 10000 },
      logging: false,
      models: [Domain, Keyword, GscAccount, ArticleKeyword],
   });
} else {
   // Fallback SQLite (dev bez DATABASE_URL)
   // eslint-disable-next-line @typescript-eslint/no-var-requires
   const sqlite3 = require('sqlite3');
   connection = new Sequelize({
      dialect: 'sqlite',
      host: '0.0.0.0',
      username: process.env.USER_NAME ? process.env.USER_NAME : process.env.USER,
      password: process.env.PASSWORD,
      database: 'sequelize',
      dialectModule: sqlite3,
      pool: { max: 5, min: 0, idle: 10000 },
      logging: false,
      models: [Domain, Keyword, GscAccount, ArticleKeyword],
      storage: './data/database.sqlite',
   });
}

export default connection;
