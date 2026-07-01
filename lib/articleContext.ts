import db from '../database/database';
import { getArticleIdSql } from './articleSql';
import { safeJsonParse } from './safeJson';
import { parseSnapshot } from './coverageStore';
import type { CoverageSnapshot } from './aiCoverage';
import type { ScoreData } from './contentScore';
import { readArticleTerms, type ArticleTermRow } from './articleTerms';
import { readContentSettings } from './contentSettings';
import { getDomainVoices } from './domainVoices';

export interface CompetitorContext {
  domain: string;
  url?: string;
  title?: string;
  headings?: string[];
  termsCount?: number;
}

export interface ArticleContext {
  articleId: number;
  keyword: string;
  language?: string;
  scoreData: ScoreData | null;     // null when the article has no score_data yet — no fabricated empty
  breakdown: null;                 // wired in a later sub-project if needed; kept null-typed in B
  coverage: CoverageSnapshot | null;
  paa: string[];
  terms: ArticleTermRow[];
  competitors: CompetitorContext[];
  brandKnowledge?: string;
  voiceTone?: string;
  customRules?: string;
  contentType?: string;
}

/** Read-only aggregator: assembles one ArticleContext from all its DB sources. Never writes. Sparse on missing data.
 *  Request-scoped: it issues several small SELECTs (article row + terms + competitors + settings + voices) — that is
 *  intentional and fine; do NOT prematurely collapse them into a mega-join. */
export async function buildArticleContext(articleId: number): Promise<ArticleContext> {
  const idSql = await getArticleIdSql();
  // Explicit columns only — never SELECT * (smaller transfer, migration-independent, easier review).
  const [rows] = (await db.query(
    `SELECT id, target_keyword, language, score_data, ai_info_to_cover, domain_id
       FROM articles WHERE ${idSql} = ?`,
    { replacements: [articleId] },
  )) as [Array<Record<string, unknown>>, unknown];
  const row = rows?.[0];

  // null (not a fake empty object) when the column is absent/unparseable — consumers guard with `if (ctx.scoreData)`.
  const scoreData = row?.score_data != null
    ? safeJsonParse<ScoreData | null>(row.score_data as string, null)
    : null;
  const coverage = parseSnapshot(row?.ai_info_to_cover);
  const paaRaw = (scoreData as { paa_questions?: unknown } | null)?.paa_questions;
  const paa = Array.isArray(paaRaw) ? paaRaw.filter((q): q is string => typeof q === 'string') : [];

  const terms = await readArticleTerms(articleId);

  const [compRows] = (await db.query(
    `SELECT domain, url, title, headings_json, terms_json FROM article_competitors WHERE article_id = ?`,
    { replacements: [articleId] },
  )) as [Array<Record<string, unknown>>, unknown];
  const competitors: CompetitorContext[] = (compRows ?? []).map((c) => {
    // Parse each JSON column ONCE, then reuse (no double safeJsonParse).
    const headingsRaw = safeJsonParse<unknown[]>(c.headings_json as string, []);
    const termsRaw = safeJsonParse<unknown[]>(c.terms_json as string, []);
    return {
      domain: String(c.domain ?? ''),
      url: typeof c.url === 'string' ? c.url : undefined,
      title: typeof c.title === 'string' ? c.title : undefined,
      headings: Array.isArray(headingsRaw) ? headingsRaw.filter((h): h is string => typeof h === 'string') : [],
      termsCount: Array.isArray(termsRaw) ? termsRaw.length : 0,
    };
  });

  // Brand knowledge (global, file-backed) + per-domain voice tone. Best-effort: never throw the
  // whole aggregator on a settings read failure — fall back to sparse/undefined fields instead.
  const brand = await readContentSettings().catch(() => null);
  const voices = row?.domain_id != null ? await getDomainVoices(Number(row.domain_id)).catch(() => null) : null;
  const defaultVoice = voices?.find((v) => v.isDefault);

  return {
    articleId,
    keyword: typeof row?.target_keyword === 'string' ? row.target_keyword : '',
    language: typeof row?.language === 'string' ? row.language : undefined,
    scoreData,
    breakdown: null,
    coverage,
    paa,
    terms,
    competitors,
    brandKnowledge: brand?.brandKnowledge || undefined,
    voiceTone: defaultVoice?.description || undefined,
    // No `customRules`/`instructions` accessor exists yet in ContentSettings — left undefined
    // until a real source of truth is added (see docs/superpowers/specs/2026-06-30-shared-context-design.md).
    customRules: undefined,
    // `articles` has no content_type column yet — selecting it would throw ("column does not exist").
    // Field kept optional (always undefined) until a migration adds the column.
    contentType: undefined,
  };
}
