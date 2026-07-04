import db from '../../database/database';

/**
 * Typed raw-SQL helpers. Articles (and several other tables) are read via raw `db.query`, so call
 * sites do `(rows as any[])[0]` everywhere — every column access is unchecked. queryRows/queryOne
 * give one place to cast and a typed result, so a renamed/dropped column is caught at the call site.
 */
export async function queryRows<T = Record<string, unknown>>(sql: string, replacements: unknown[] = []): Promise<T[]> {
  const [rows] = await db.query(sql, { replacements });
  return rows as T[];
}

export async function queryOne<T = Record<string, unknown>>(sql: string, replacements: unknown[] = []): Promise<T | undefined> {
  const rows = await queryRows<T>(sql, replacements);
  return rows[0];
}

/**
 * A row of the `articles` table (raw-SQL shape, mirrors lib/ensureArticlesTables). Columns are
 * nullable as stored; JSON columns are strings (parse at the boundary). Use with queryOne<ArticleRow>.
 */
export interface ArticleRow {
  id: number;
  domain_id: number;
  title: string | null;
  slug: string | null;
  content: string | null;
  status: string | null;
  target_keyword: string | null;
  language: string | null;
  meta_title: string | null;
  meta_description: string | null;
  meta_url: string | null;
  schema_json: string | null;
  score_data: string | null;
  word_count: number | null;
  featured_image: string | null;
  competitor_outlines_cache: string | null;
  internal_links_cache: string | null;
  content_score: number | null;
  ranking_score: number | null;
  ranking_signals: string | null;
  ranking_sources: string | null;
  share_token: string | null;
  wizard_state: string | null;
  plagiarism_json: string | null;
  ai_readability_json: string | null;
  wp_post_id: number | null;
  wp_post_status: string | null;
  published_at: string | null;
  publish_target: string | null;
  publish_url: string | null;
  scheduled_for: string | null;
  created_at: string | null;
  updated_at: string | null;
}

/**
 * A row of the `audit_runs` table (see lib/ensureAuditTables). One row per (url, keyword).
 * result_json is a serialized AuditResult (lib/auditTypes); parse at the boundary.
 */
export interface AuditRunRow {
  id: number;
  domain_id: number;
  url: string;
  keyword: string;
  status: string;
  content_score: number | null;
  result_json: string | null;
  progress_done: number | null;
  progress_total: number | null;
  error: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string | null;
}
