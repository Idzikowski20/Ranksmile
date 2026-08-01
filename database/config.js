/**
 * Sequelize CLI config — Neon Postgres when DATABASE_URL is set.
 * `production` never falls back to SQLite.
 */

const url = (process.env.DATABASE_URL || '').trim();

const postgres = {
  url,
  dialect: 'postgres',
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false,
    },
  },
  logging: false,
};

const sqlite = {
  username: process.env.USER_NAME ? process.env.USER_NAME : process.env.USER,
  password: process.env.PASSWORD,
  database: 'sequelize',
  host: 'database',
  port: 3306,
  dialect: 'sqlite',
  storage: './data/database.sqlite',
  dialectOptions: {
    bigNumberStrings: true,
  },
  logging: false,
};

module.exports = {
  get production() {
    if (!url) {
      throw new Error('DATABASE_URL required for production migrations (refusing SQLite fallback)');
    }
    return postgres;
  },
  development: url ? postgres : sqlite,
  test: url ? postgres : sqlite,
};
