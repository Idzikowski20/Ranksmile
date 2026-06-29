import type * as cheerio from 'cheerio';
import type { ScoreData } from '../contentScore';

export interface InternalArticleRef {
  id?: number;
  title: string;
  url: string;
}

/** Per-run memo for DB/sidecar results, so the three sidecar-backed tools don't
 *  repeat the same `resolveArticleSeoMeta` query or re-run identical analyses
 *  when the model calls them twice within one agent run. */
export interface ToolCache {
  seoMeta?: { domain: string; language: string; targetKeyword: string; competitorDomains: string[] };
  aiSearch?: unknown;
  plagiarism?: unknown;
  competitors?: unknown;
}

/** Per-request context shared by every tool. Write tools mutate `$`, `meta`,
 *  `htmlDirty`, `writeCount`, and `changelog`. */
export interface ToolCtx {
  $: cheerio.CheerioAPI;
  keyword: string;
  scoreData: ScoreData | null;
  internalArticles: InternalArticleRef[];
  articleTitle: string;
  articleMetaDescription: string;
  changelog: Array<{ tool: string; summary: string }>;
  htmlDirty: boolean;
  /** Number of write-tool executions this turn (bounded by MAX_WRITES). */
  writeCount: number;
  meta: { metaTitle?: string; metaDescription?: string } | null;
  /** Article id (for DB/sidecar-backed tools). null when unavailable. */
  articleId: number | null;
  /** Per-run memo for DB/sidecar results (avoids repeat queries within one turn). */
  cache: ToolCache;
}

export interface ToolResult {
  ok: boolean;
  summary: string;
}
