import crypto from 'crypto';
import { QueryTypes } from 'sequelize';
import db from '../database/database';
import { getArticleIdSql } from './articleSql';
import type { DbRow, SqlReplacements } from './types/db';

/** Stable per-article hash the plugin stores alongside the post (Surfer's permalink_hash). */
export const permalinkHash = (id: number | string): string => crypto.createHash('md5').update(`wp-art-${id}`).digest('hex').slice(0, 16);

const toIso = (d: unknown): string => { try { return new Date(d as string | number | Date).toISOString(); } catch { return new Date().toISOString(); } };

/** Map our article row to the Surfer "draft" shape the WP plugin consumes (see get_user_drafts). */
export function articleToDraft(a: DbRow) {
   const kw = String(a.target_keyword ?? '');
   const id = a.id as number | string;
   return {
      id,
      title: String(a.title ?? ''),
      content: String(a.content ?? ''),
      keyword: { item: kw },
      keywords: kw ? [{ item: kw }] : [],
      scrape: { location: 'United States' },
      seo_guidelines: [{ location: 'United States' }],
      folder: null,
      updated_at: toIso(a.updated_at ?? a.created_at),
      permalink_hash: permalinkHash(id),
      progress_snapshots: [{ name: 'content_score', value: Number(a.content_score) || 0 }],
      connected_wordpress_post: null,
      active_draft_article: null,
   };
}

/** Workspace → its domain id (workspace == domain in our tenancy). */
export async function getDomainIdForWorkspace(workspaceId: number): Promise<number | null> {
   const [rows] = await db.query('SELECT "ID" AS id FROM domain WHERE workspace_id = ? ORDER BY "ID" ASC LIMIT 1', { replacements: [workspaceId] });
   return ((rows as DbRow[])[0]?.id as number | undefined) ?? null;
}

export async function createArticleFromWp(p: { domainId: number; title: string; keyword: string; content: string }): Promise<number | undefined> {
   const articleIdSql = await getArticleIdSql();
   const cols = "domain_id, title, target_keyword, content, status, source, created_at, updated_at";
   const vals = "?, ?, ?, ?, 'draft', 'wordpress', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP";
   if (process.env.DATABASE_URL) {
      const rows = await db.query<{ id: number }>(
         `INSERT INTO articles (${cols}) VALUES (${vals}) RETURNING ${articleIdSql} AS id`,
         { replacements: [p.domainId, p.title, p.keyword, p.content], type: QueryTypes.SELECT },
      );
      return rows[0]?.id;
   }
   const [id] = await db.query(
      `INSERT INTO articles (${cols}) VALUES (${vals})`,
      { replacements: [p.domainId, p.title, p.keyword, p.content], type: QueryTypes.INSERT },
   );
   return id as unknown as number;
}

export async function updateArticleContent(id: number, content: string): Promise<void> {
   const articleIdSql = await getArticleIdSql();
   await db.query(`UPDATE articles SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE ${articleIdSql} = ?`, { replacements: [content, id] });
}

export async function getArticleRow(id: number): Promise<DbRow | null> {
   const articleIdSql = await getArticleIdSql();
   const [rows] = await db.query(
      `SELECT ${articleIdSql} AS id, domain_id, title, content, target_keyword, content_score, created_at, updated_at FROM articles WHERE ${articleIdSql} = ? LIMIT 1`,
      { replacements: [id] },
   );
   return (rows as DbRow[])[0] || null;
}

export async function listArticlesForDomain(domainId: number, query: string): Promise<DbRow[]> {
   const articleIdSql = await getArticleIdSql();
   let where = 'WHERE domain_id = ?';
   const repl: SqlReplacements = [domainId];
   if (query && query.trim()) {
      where += ' AND (LOWER(title) LIKE ? OR LOWER(target_keyword) LIKE ?)';
      const q = `%${query.trim().toLowerCase()}%`;
      repl.push(q, q);
   }
   const [rows] = await db.query(
      `SELECT ${articleIdSql} AS id, title, content, target_keyword, content_score, created_at, updated_at FROM articles ${where} ORDER BY updated_at DESC LIMIT 100`,
      { replacements: repl },
   );
   return rows as DbRow[];
}
