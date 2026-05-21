import { Sequelize } from 'sequelize-typescript';
import Domain from './models/domain';
import Keyword from './models/keyword';
import GscAccount from './models/gscAccount';

const DATABASE_URL = process.env.DATABASE_URL;

let connection: Sequelize;

if (DATABASE_URL) {
   // Neon PostgreSQL
   connection = new Sequelize(DATABASE_URL, {
      dialect: 'postgres',
      dialectOptions: {
         ssl: {
            require: true,
            rejectUnauthorized: false,
         },
      },
      pool: { max: 5, min: 0, idle: 10000 },
      logging: false,
      models: [Domain, Keyword, GscAccount],
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
      models: [Domain, Keyword, GscAccount],
      storage: './data/database.sqlite',
   });
}

export default connection;
