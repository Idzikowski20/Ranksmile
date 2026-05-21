import { QueryTypes } from 'sequelize';
import db from '../database/database';

const isPostgres = !!process.env.DATABASE_URL;

let articleIdColumnCache: 'id' | 'ID' | null = null;

export async function getArticleIdColumn(): Promise<'id' | 'ID'> {
  if (articleIdColumnCache) return articleIdColumnCache;

  try {
    if (isPostgres) {
      const rows = await db.query<{ column_name: 'id' | 'ID' }>(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_name = 'articles'
           AND column_name IN ('id', 'ID')
         ORDER BY CASE WHEN table_schema = current_schema() THEN 0 ELSE 1 END,
                  CASE WHEN column_name = 'ID' THEN 0 ELSE 1 END
         LIMIT 1`,
        { type: QueryTypes.SELECT },
      );
      articleIdColumnCache = rows[0]?.column_name || 'ID';
      return articleIdColumnCache;
    }

    const rows = await db.query<{ name: string }>(`PRAGMA table_info(articles)`, { type: QueryTypes.SELECT });
    const names = rows.map((row) => row.name);
    articleIdColumnCache = names.includes('ID') ? 'ID' : 'id';
    return articleIdColumnCache;
  } catch {
    articleIdColumnCache = isPostgres ? 'ID' : 'id';
    return articleIdColumnCache;
  }
}

export async function getArticleIdSql(): Promise<string> {
  const column = await getArticleIdColumn();
  return column === 'ID' ? '"ID"' : 'id';
}
