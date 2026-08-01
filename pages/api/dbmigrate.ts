import { Sequelize } from 'sequelize';
import { Umzug, SequelizeStorage } from 'umzug';
import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../database/database';
import verifyUser from '../../utils/verifyUser';
import { getCurrentUserId } from '../../utils/getUser';
import { getCallerRole } from '../../lib/members';
import { withOrgPaymentAccess } from '../../lib/requireOrgPaymentAccess';

type MigrationGetResponse = {
   hasMigrations: boolean,
}

type MigrationPostResponse = {
   migrated: boolean,
   error?: string
}

function migrateEndpointEnabled(): boolean {
   return process.env.ENABLE_DB_MIGRATE_ENDPOINT === 'true' || process.env.ENABLE_DB_MIGRATE_ENDPOINT === '1';
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
   if (process.env.NODE_ENV === 'production') {
      throw new Error('DATABASE_URL required in production');
   }
   // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
   const sqlite3 = require('sqlite3');
   return new Sequelize({
      dialect: 'sqlite',
      dialectModule: sqlite3,
      storage: './data/database.sqlite',
      logging: false,
   });
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
   if (!migrateEndpointEnabled()) {
      return res.status(404).json({ error: 'Not found' });
   }

   const authorized = await verifyUser(req, res);
   if (authorized !== 'authorized') return res.status(401).json({ error: authorized });

   const userId = await getCurrentUserId(req, res);
   if (!userId) return res.status(401).json({ error: 'Not authorized' });
   const role = await getCallerRole(String(userId)).catch(() => null);
   if (role !== 'owner') {
      return res.status(403).json({ migrated: false, error: 'Owner only.' });
   }

   if (req.method === 'GET') {
      await db.sync();
      return getMigrationStatus(req, res);
   }
   if (req.method === 'POST') {
      return migrateDatabase(req, res);
   }
   return res.status(405).json({ error: 'Method not allowed' });
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

export default withOrgPaymentAccess(handler);
