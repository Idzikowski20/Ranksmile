import { Sequelize } from 'sequelize';
import { Umzug, SequelizeStorage } from 'umzug';
import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../database/database';
import verifyUser from '../../utils/verifyUser';

type MigrationGetResponse = {
   hasMigrations: boolean,
}

type MigrationPostResponse = {
   migrated: boolean,
   error?: string
}

function getSequelizeForMigrations(): Sequelize {
   const DATABASE_URL = process.env.DATABASE_URL;
   if (DATABASE_URL) {
      return new Sequelize(DATABASE_URL, {
         dialect: 'postgres',
         dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
         logging: false,
      });
   }
   // eslint-disable-next-line @typescript-eslint/no-var-requires
   const sqlite3 = require('sqlite3');
   return new Sequelize({
      dialect: 'sqlite',
      dialectModule: sqlite3,
      storage: './data/database.sqlite',
      logging: false,
   });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   const authorized = await verifyUser(req, res);
   if (authorized === 'authorized' && req.method === 'GET') {
      await db.sync();
      return getMigrationStatus(req, res);
   }
   if (authorized === 'authorized' && req.method === 'POST') {
      return migrateDatabase(req, res);
   }
   return res.status(401).json({ error: authorized });
}

const getMigrationStatus = async (req: NextApiRequest, res: NextApiResponse<MigrationGetResponse>) => {
   const sequelize = getSequelizeForMigrations();
   const umzug = new Umzug({
      migrations: { glob: 'database/migrations/*.js' },
      context: sequelize.getQueryInterface(),
      storage: new SequelizeStorage({ sequelize }),
      logger: undefined,
   });
   const migrations = await umzug.pending();
   return res.status(200).json({ hasMigrations: migrations.length > 0 });
};

const migrateDatabase = async (req: NextApiRequest, res: NextApiResponse<MigrationPostResponse>) => {
   const sequelize = getSequelizeForMigrations();
   const umzug = new Umzug({
      migrations: { glob: 'database/migrations/*.js' },
      context: sequelize.getQueryInterface(),
      storage: new SequelizeStorage({ sequelize }),
      logger: undefined,
   });
   const migrations = await umzug.up();
   console.log('[Updated] migrations :', migrations);
   return res.status(200).json({ migrated: true });
};
