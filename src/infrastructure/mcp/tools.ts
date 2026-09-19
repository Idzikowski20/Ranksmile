/**
 * Read-only diagnostic tools exposed over MCP.
 *
 * The set is deliberately narrow and non-mutating: it answers "why is this article
 * weak" and "what did Auto-Optimize actually do" from the same rows the app reads,
 * so an agent can inspect a tenant without a write path existing at all.
 *
 * Every handler re-derives access from the token's user id — never from an argument.
 */
import { queryOne, queryRows, type ArticleRow } from '@/src/infrastructure/db/query';
import { getAccessibleWorkspaceIds, assertArticleAccess } from '@/src/infrastructure/identity/tenancy';
import { getArticleIdSql } from '@/src/infrastructure/articles/articleSql';
import {
   computeContentScore,
   computeContentScoreBreakdown,
   updateTermsCoverage,
   type ScoreData,
} from '@/src/infrastructure/articles/contentScore';
import { parseJsonish } from '@/src/core/shared/types/json';

export type JsonSchema = { type: 'object'; properties: Record<string, unknown>; required?: string[] };

/**
 * Every tool here reads and never writes, so the hints are identical across the set.
 * Hosts use them to decide what may run without a fresh confirmation.
 */
const READ_ONLY = {
   readOnlyHint: true,
   destructiveHint: false,
   idempotentHint: true,
   openWorldHint: false,
} as const;

export type McpTool = {
   name: string;
   title: string;
   description: string;
   inputSchema: JsonSchema;
   /** Declared so hosts can type the result and call the tool from generated code. */
   outputSchema: JsonSchema;
   annotations: typeof READ_ONLY;
   handler: (userId: string, args: Record<string, unknown>) => Promise<unknown>;
};

const NULLABLE_NUMBER = { type: ['number', 'null'] };
const NULLABLE_STRING = { type: ['string', 'null'] };

/** A tool failure the agent is meant to read (bad id, no access) — not a server fault. */
export class McpToolError extends Error {}

const num = (v: unknown): number | undefined => {
   const n = Number(v);
   return Number.isFinite(n) ? n : undefined;
};

const clampLimit = (v: unknown, fallback = 20, max = 100): number => {
   const n = num(v);
   if (n === undefined || n <= 0) return fallback;
   return Math.min(Math.floor(n), max);
};

const plainTextOf = (html: string): string => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

async function requireArticle(userId: string, args: Record<string, unknown>): Promise<ArticleRow> {
   const id = num(args.article_id);
   if (id === undefined) throw new McpToolError('article_id is required');
   if (!(await assertArticleAccess(userId, id))) throw new McpToolError(`article ${id} not found or not accessible`);
   const idSql = await getArticleIdSql();
   const row = await queryOne<ArticleRow>(`SELECT *, ${idSql} AS id FROM articles WHERE ${idSql} = ? LIMIT 1`, [id]);
   if (!row) throw new McpToolError(`article ${id} not found`);
   return row;
}

const workspaceList: McpTool = {
   name: 'workspace__list',
   title: 'List workspaces',
   description: 'List the Ranksmile workspaces the connected account can access, with their primary domain.',
   inputSchema: { type: 'object', properties: {} },
   outputSchema: {
      type: 'object',
      properties: {
         workspaces: {
            type: 'array',
            items: {
               type: 'object',
               properties: { id: { type: 'number' }, name: { type: 'string' }, domain: NULLABLE_STRING },
               required: ['id', 'name'],
            },
         },
      },
      required: ['workspaces'],
   },
   annotations: READ_ONLY,
   async handler(userId) {
      const ids = await getAccessibleWorkspaceIds(userId);
      if (!ids.length) return { workspaces: [] };
      const holes = ids.map(() => '?').join(',');
      const rows = await queryRows<{ id: number; name: string; domain: string | null }>(
         `SELECT w.id, w.name, (SELECT d.domain FROM domain d WHERE d.workspace_id = w.id LIMIT 1) AS domain
            FROM workspaces w WHERE w.id IN (${holes}) ORDER BY w.id ASC`,
         ids,
      );
      return { workspaces: rows };
   },
};

const articleList: McpTool = {
   name: 'article__list',
   title: 'List articles',
   description:
      'List articles with their stored scores and word counts. Filter by workspace_id or status. '
      + 'Use this first to find the article ids the other tools take.',
   inputSchema: {
      type: 'object',
      properties: {
         workspace_id: { type: 'number', description: 'Restrict to one workspace (default: all accessible).' },
         status: { type: 'string', description: 'Exact status filter, e.g. "draft" or "published".' },
         limit: { type: 'number', description: 'Max rows, 1-100 (default 20).' },
      },
   },
   outputSchema: {
      type: 'object',
      properties: {
         articles: {
            type: 'array',
            items: {
               type: 'object',
               properties: {
                  id: { type: 'number' },
                  title: NULLABLE_STRING,
                  status: NULLABLE_STRING,
                  target_keyword: NULLABLE_STRING,
                  content_score: NULLABLE_NUMBER,
                  ranking_score: NULLABLE_NUMBER,
                  word_count: NULLABLE_NUMBER,
                  domain: NULLABLE_STRING,
                  workspace_id: { type: 'number' },
                  updated_at: NULLABLE_STRING,
               },
               required: ['id', 'workspace_id'],
            },
         },
      },
      required: ['articles'],
   },
   annotations: READ_ONLY,
   async handler(userId, args) {
      const accessible = await getAccessibleWorkspaceIds(userId);
      const wanted = num(args.workspace_id);
      const scope = wanted === undefined ? accessible : accessible.filter((id) => id === wanted);
      if (!scope.length) return { articles: [] };

      const idSql = await getArticleIdSql();
      const holes = scope.map(() => '?').join(',');
      const params: unknown[] = [...scope];
      let statusClause = '';
      if (typeof args.status === 'string' && args.status.trim()) {
         statusClause = ' AND a.status = ?';
         params.push(args.status.trim());
      }
      const rows = await queryRows<{
         id: number; title: string | null; status: string | null; target_keyword: string | null;
         content_score: number | null; ranking_score: number | null; word_count: number | null;
         domain: string | null; workspace_id: number; updated_at: string | null;
      }>(
         `SELECT ${idSql} AS id, a.title, a.status, a.target_keyword, a.content_score, a.ranking_score,
                 a.word_count, d.domain, d.workspace_id, a.updated_at
            FROM articles a JOIN domain d ON d."ID" = a.domain_id
           WHERE d.workspace_id IN (${holes})${statusClause}
           ORDER BY a.updated_at DESC, ${idSql} DESC
           LIMIT ${clampLimit(args.limit)}`,
         params,
      );
      return { articles: rows };
   },
};

const articleGet: McpTool = {
   name: 'article__get',
   title: 'Get article',
   description:
      'Get one article: metadata, stored scores, and (optionally) the HTML body. '
      + 'Read the body when judging writing quality; skip it when you only need numbers.',
   inputSchema: {
      type: 'object',
      properties: {
         article_id: { type: 'number' },
         include_content: { type: 'boolean', description: 'Include the HTML body (default true).' },
         max_content_chars: { type: 'number', description: 'Truncate the body at N characters (default 20000).' },
      },
      required: ['article_id'],
   },
   outputSchema: {
      type: 'object',
      properties: {
         id: { type: 'number' },
         title: NULLABLE_STRING,
         slug: NULLABLE_STRING,
         status: NULLABLE_STRING,
         language: NULLABLE_STRING,
         target_keyword: NULLABLE_STRING,
         meta_title: NULLABLE_STRING,
         meta_description: NULLABLE_STRING,
         content_score: NULLABLE_NUMBER,
         ranking_score: NULLABLE_NUMBER,
         word_count: NULLABLE_NUMBER,
         published_at: NULLABLE_STRING,
         updated_at: NULLABLE_STRING,
         content_length: { type: 'number' },
         content_truncated: { type: 'boolean' },
         content_html: { type: 'string' },
      },
      required: ['id', 'content_length'],
   },
   annotations: READ_ONLY,
   async handler(userId, args) {
      const a = await requireArticle(userId, args);
      const includeContent = args.include_content !== false;
      const cap = clampLimit(args.max_content_chars, 20000, 200000);
      const html = a.content || '';
      return {
         id: a.id,
         title: a.title,
         slug: a.slug,
         status: a.status,
         language: a.language,
         target_keyword: a.target_keyword,
         meta_title: a.meta_title,
         meta_description: a.meta_description,
         content_score: a.content_score,
         ranking_score: a.ranking_score,
         word_count: a.word_count,
         published_at: a.published_at,
         updated_at: a.updated_at,
         content_length: html.length,
         content_truncated: includeContent && html.length > cap,
         content_html: includeContent ? html.slice(0, cap) : undefined,
      };
   },
};

const articleScore: McpTool = {
   name: 'article__score',
   title: 'Explain article score',
   description:
      "Explain an article's content score: the per-slot breakdown, word/heading/paragraph counts against "
      + 'their competitor-derived targets, and every NLP term with its current vs. required usage. '
      + 'This is the tool that says WHY a generated article scores badly.',
   inputSchema: { type: 'object', properties: { article_id: { type: 'number' } }, required: ['article_id'] },
   outputSchema: {
      type: 'object',
      properties: {
         article_id: { type: 'number' },
         target_keyword: { type: 'string' },
         score: {
            type: 'object',
            properties: { computed: { type: 'number' }, stored: NULLABLE_NUMBER, total_possible: { type: 'number' } },
         },
         breakdown: {
            type: 'array',
            description: 'Per-slot points earned vs. available, with the hint explaining the gap.',
            items: {
               type: 'object',
               properties: {
                  key: { type: 'string' },
                  label: { type: 'string' },
                  earned: { type: 'number' },
                  max: { type: 'number' },
                  hint: { type: 'string' },
               },
            },
         },
         counts: {
            type: 'object',
            description: 'Actual document counts against the competitor-derived targets.',
            properties: {
               words: { type: 'object' },
               headings: { type: 'object' },
               paragraphs: { type: 'object' },
               internal_links: { type: 'number' },
            },
         },
         terms: {
            type: 'array',
            items: {
               type: 'object',
               properties: {
                  term: { type: 'string' },
                  target_count: { type: 'number' },
                  current_count: { type: 'number' },
                  suggested_min: { type: 'number' },
                  suggested_max: { type: 'number' },
               },
               required: ['term'],
            },
         },
         terms_missing: { type: 'array', items: { type: 'string' } },
      },
      required: ['article_id', 'score', 'breakdown', 'counts', 'terms_missing'],
   },
   annotations: READ_ONLY,
   async handler(userId, args) {
      const a = await requireArticle(userId, args);
      const html = a.content || '';
      const text = plainTextOf(html);
      const words = text ? text.split(/\s+/).length : 0;
      const headings = (html.match(/<h[1-6]\b/gi) || []).length;
      const paragraphs = (html.match(/<p\b/gi) || []).length;
      const links = (html.match(/<a\s[^>]*href=/gi) || []).length;

      const sd: ScoreData = parseJsonish<ScoreData>(a.score_data) || ({} as ScoreData);
      if (Array.isArray(sd.terms)) sd.terms = updateTermsCoverage(text, sd.terms);
      const keyword = a.target_keyword || '';
      const computed = computeContentScore(text, words, headings, sd, paragraphs, links, html, keyword);
      const breakdown = computeContentScoreBreakdown(text, words, headings, sd, paragraphs, html, keyword);

      const terms = Array.isArray(sd.terms) ? sd.terms : [];
      return {
         article_id: a.id,
         target_keyword: keyword,
         score: { computed, stored: a.content_score, total_possible: breakdown.totalPossible },
         breakdown: breakdown.slots,
         counts: {
            words: { actual: words, target: sd.words_target ?? null, min: sd.words_min ?? null, max: sd.words_max ?? null },
            headings: { actual: headings, target: sd.headings_target ?? null, min: sd.headings_min ?? null, max: sd.headings_max ?? null },
            paragraphs: { actual: paragraphs, target: sd.paragraphs_target ?? null, min: sd.paragraphs_min ?? null, max: sd.paragraphs_max ?? null },
            internal_links: links,
         },
         terms,
         terms_missing: terms.filter((t) => Number(t.current_count ?? 0) === 0).map((t) => t.term),
      };
   },
};

const articleOptimizeLog: McpTool = {
   name: 'article__optimize_log',
   title: 'Auto-Optimize history',
   description:
      'The Auto-Optimize / publish history for an article: before and after score, before and after length, '
      + 'and the run metadata (mode, phase, rejection reason). Use this when Auto-Optimize appears to change nothing.',
   inputSchema: {
      type: 'object',
      properties: { article_id: { type: 'number' }, limit: { type: 'number', description: 'Max runs, 1-100 (default 10).' } },
      required: ['article_id'],
   },
   outputSchema: {
      type: 'object',
      properties: {
         article_id: { type: 'number' },
         runs: {
            type: 'array',
            items: {
               type: 'object',
               properties: {
                  id: { type: 'number' },
                  kind: { type: 'string' },
                  created_at: NULLABLE_STRING,
                  before_len: NULLABLE_NUMBER,
                  after_len: NULLABLE_NUMBER,
                  before_score: NULLABLE_NUMBER,
                  after_score: NULLABLE_NUMBER,
                  length_delta: { type: 'number' },
                  score_delta: { type: 'number' },
                  meta: { type: ['object', 'null'], description: 'Run metadata: mode, phase, rejection reason.' },
               },
               required: ['id', 'kind'],
            },
         },
      },
      required: ['article_id', 'runs'],
   },
   annotations: READ_ONLY,
   async handler(userId, args) {
      const a = await requireArticle(userId, args);
      const rows = await queryRows<{
         id: number; kind: string; before_len: number | null; after_len: number | null;
         before_score: number | null; after_score: number | null; meta_json: string | null; created_at: string | null;
      }>(
         `SELECT id, kind, before_len, after_len, before_score, after_score, meta_json, created_at
            FROM optimize_logs WHERE article_id = ? ORDER BY id DESC LIMIT ${clampLimit(args.limit, 10)}`,
         [a.id],
      );
      return {
         article_id: a.id,
         runs: rows.map((r) => ({
            id: r.id,
            kind: r.kind,
            created_at: r.created_at,
            before_len: r.before_len,
            after_len: r.after_len,
            before_score: r.before_score,
            after_score: r.after_score,
            length_delta: (r.after_len ?? 0) - (r.before_len ?? 0),
            score_delta: (r.after_score ?? 0) - (r.before_score ?? 0),
            meta: r.meta_json ? parseJsonish<Record<string, unknown>>(r.meta_json) : null,
         })),
      };
   },
};

const articleJobs: McpTool = {
   name: 'article__jobs',
   title: 'Generation jobs',
   description:
      'The most recent analysis / generation jobs for an article, with status, payload and result. '
      + 'Use this when generated content looks wrong: it shows what the generator was told and what it returned.',
   inputSchema: {
      type: 'object',
      properties: { article_id: { type: 'number' }, limit: { type: 'number', description: 'Max jobs, 1-100 (default 5).' } },
      required: ['article_id'],
   },
   outputSchema: {
      type: 'object',
      properties: {
         article_id: { type: 'number' },
         jobs: {
            type: 'array',
            items: {
               type: 'object',
               properties: {
                  status: NULLABLE_STRING,
                  created_at: NULLABLE_STRING,
                  payload: { description: 'What the generator was asked for.' },
                  result: { description: 'What the generator returned.' },
               },
            },
         },
      },
      required: ['article_id', 'jobs'],
   },
   annotations: READ_ONLY,
   async handler(userId, args) {
      const a = await requireArticle(userId, args);
      const rows = await queryRows<{ status: string | null; payload: string | null; result: string | null; created_at: string | null }>(
         `SELECT status, payload, result, created_at FROM analysis_jobs
           WHERE article_id = ? ORDER BY created_at DESC LIMIT ${clampLimit(args.limit, 5)}`,
         [a.id],
      );
      return {
         article_id: a.id,
         jobs: rows.map((r) => ({
            status: r.status,
            created_at: r.created_at,
            payload: r.payload ? parseJsonish<unknown>(r.payload) : null,
            result: r.result ? parseJsonish<unknown>(r.result) : null,
         })),
      };
   },
};

export const MCP_TOOLS: McpTool[] = [
   workspaceList,
   articleList,
   articleGet,
   articleScore,
   articleOptimizeLog,
   articleJobs,
];

export function findTool(name: string): McpTool | undefined {
   return MCP_TOOLS.find((t) => t.name === name);
}
