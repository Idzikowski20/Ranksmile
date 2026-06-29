import type * as cheerio from 'cheerio';
import type { ScoreData } from '../contentScore';

export interface InternalArticleRef {
  id?: number;
  title: string;
  url: string;
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
}

export interface ToolResult {
  ok: boolean;
  summary: string;
}
