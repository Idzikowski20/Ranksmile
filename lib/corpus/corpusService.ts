/**
 * Corpus Service — bounded context API for SERP corpora / fingerprints.
 * Pipeline workers consume this API only; they do not own scrape/persist logic.
 */
import { createHash, randomUUID } from 'crypto';
import db from '../../database/database';
import { ensureCorpusTables } from '../ensureCorpusTables';
import { PIPELINE_VERSION } from '../pipeline/queuePriorities';

export type VolatilityClass = 'high' | 'medium' | 'low' | 'stable';

export type CorpusRecord = {
  id: string;
  workspaceId: string;
  keyword: string;
  language: string;
  corpusVersion: number;
  pipelineVersion: string;
  volatilityClass: VolatilityClass;
  urls: string[];
  fetchedAt: string;
  expiresAt: string;
};

const REFRESH_HOURS: Record<VolatilityClass, number> = {
  high: 6,
  medium: 24,
  low: 24 * 14,
  stable: 24 * 30,
};

export function refreshHoursFor(v: VolatilityClass): number {
  return REFRESH_HOURS[v] ?? 24;
}

function parseUrls(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((u): u is string => typeof u === 'string');
  if (typeof raw === 'string') {
    try {
      return parseUrls(JSON.parse(raw));
    } catch {
      return [];
    }
  }
  return [];
}

function rowToCorpus(r: Record<string, unknown>): CorpusRecord {
  return {
    id: String(r.corpus_id),
    workspaceId: String(r.workspace_id),
    keyword: String(r.keyword),
    language: String(r.language),
    corpusVersion: Number(r.corpus_version),
    pipelineVersion: String(r.pipeline_version),
    volatilityClass: (r.volatility_class as VolatilityClass) || 'medium',
    urls: parseUrls(r.urls_json),
    fetchedAt: String(r.fetched_at),
    expiresAt: String(r.expires_at),
  };
}

export async function getFreshCorpus(opts: {
  workspaceId: string;
  keyword: string;
  language?: string;
}): Promise<CorpusRecord | null> {
  await ensureCorpusTables();
  const language = opts.language || 'pl';
  const [rows] = await db.query(
    `SELECT * FROM serp_corpora
     WHERE workspace_id = ? AND keyword = ? AND language = ?
       AND expires_at > ${process.env.DATABASE_URL ? 'NOW()' : "datetime('now')"}
     ORDER BY corpus_version DESC LIMIT 1`,
    { replacements: [String(opts.workspaceId), opts.keyword.trim().toLowerCase(), language] },
  );
  const list = rows as Array<Record<string, unknown>>;
  return list[0] ? rowToCorpus(list[0]) : null;
}

export async function getCorpusById(corpusId: string): Promise<CorpusRecord | null> {
  await ensureCorpusTables();
  const [rows] = await db.query(`SELECT * FROM serp_corpora WHERE corpus_id = ? LIMIT 1`, {
    replacements: [corpusId],
  });
  const list = rows as Array<Record<string, unknown>>;
  return list[0] ? rowToCorpus(list[0]) : null;
}

export async function getLatestCorpusVersions(opts: {
  workspaceId: string;
  keyword: string;
  language?: string;
  limit?: number;
}): Promise<CorpusRecord[]> {
  await ensureCorpusTables();
  const language = opts.language || 'pl';
  const [rows] = await db.query(
    `SELECT * FROM serp_corpora
     WHERE workspace_id = ? AND keyword = ? AND language = ?
     ORDER BY corpus_version DESC LIMIT ?`,
    {
      replacements: [
        String(opts.workspaceId),
        opts.keyword.trim().toLowerCase(),
        language,
        opts.limit ?? 2,
      ],
    },
  );
  return (rows as Array<Record<string, unknown>>).map(rowToCorpus);
}

export async function createCorpusFromSerpUrls(opts: {
  workspaceId: string;
  keyword: string;
  language?: string;
  pipelineVersion?: string;
  urls: string[];
  volatilityClass?: string;
}): Promise<CorpusRecord> {
  await ensureCorpusTables();
  const language = opts.language || 'pl';
  const keyword = opts.keyword.trim().toLowerCase();
  const volatility = (opts.volatilityClass as VolatilityClass) || 'medium';
  const hours = refreshHoursFor(volatility);
  const prev = await getLatestCorpusVersions({
    workspaceId: opts.workspaceId,
    keyword,
    language,
    limit: 1,
  });
  const nextVersion = (prev[0]?.corpusVersion ?? 0) + 1;
  const corpusId = randomUUID();
  const fetchedAt = new Date();
  const expiresAt = new Date(fetchedAt.getTime() + hours * 3600 * 1000);

  await db.query(
    `INSERT INTO serp_corpora
      (corpus_id, workspace_id, keyword, language, corpus_version, pipeline_version,
       volatility_class, refresh_policy_hours, urls_json, fetched_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    {
      replacements: [
        corpusId,
        String(opts.workspaceId),
        keyword,
        language,
        nextVersion,
        opts.pipelineVersion || PIPELINE_VERSION,
        volatility,
        hours,
        JSON.stringify(opts.urls),
        fetchedAt.toISOString(),
        expiresAt.toISOString(),
      ],
    },
  );

  return {
    id: corpusId,
    workspaceId: String(opts.workspaceId),
    keyword,
    language,
    corpusVersion: nextVersion,
    pipelineVersion: opts.pipelineVersion || PIPELINE_VERSION,
    volatilityClass: volatility,
    urls: opts.urls,
    fetchedAt: fetchedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
}

export type FingerprintMetrics = {
  h2Avg: number;
  faqRate: number;
  schemaRate: number;
  tablesRate: number;
  mediaRate: number;
  citationsRate: number;
  paraLenAvg: number;
  entityCount: number;
  conceptCount: number;
};

export async function upsertFingerprint(corpusId: string, m: FingerprintMetrics): Promise<void> {
  await ensureCorpusTables();
  await db.query(
    `INSERT INTO serp_fingerprints
      (corpus_id, h2_avg, faq_rate, schema_rate, tables_rate, media_rate, citations_rate,
       para_len_avg, entity_count, concept_count, metrics_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    {
      replacements: [
        corpusId,
        m.h2Avg,
        m.faqRate,
        m.schemaRate,
        m.tablesRate,
        m.mediaRate,
        m.citationsRate,
        m.paraLenAvg,
        m.entityCount,
        m.conceptCount,
        JSON.stringify(m),
      ],
    },
  );
}

export async function getFingerprint(corpusId: string): Promise<FingerprintMetrics | null> {
  await ensureCorpusTables();
  const [rows] = await db.query(
    `SELECT * FROM serp_fingerprints WHERE corpus_id = ? ORDER BY id DESC LIMIT 1`,
    { replacements: [corpusId] },
  );
  const r = (rows as Array<Record<string, unknown>>)[0];
  if (!r) return null;
  return {
    h2Avg: Number(r.h2_avg ?? 0),
    faqRate: Number(r.faq_rate ?? 0),
    schemaRate: Number(r.schema_rate ?? 0),
    tablesRate: Number(r.tables_rate ?? 0),
    mediaRate: Number(r.media_rate ?? 0),
    citationsRate: Number(r.citations_rate ?? 0),
    paraLenAvg: Number(r.para_len_avg ?? 0),
    entityCount: Number(r.entity_count ?? 0),
    conceptCount: Number(r.concept_count ?? 0),
  };
}

/** Fraction of URLs that changed vs previous corpus (0–1). */
export { serpChangeRatio, shouldForceRefresh } from './serpChange';

export function contentHash(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 16);
}

/** Minimal SimHash-like fingerprint for near-dup detection (64-bit hex). */
export function simhash(text: string): string {
  const tokens = text.toLowerCase().split(/\W+/).filter((t) => t.length > 2);
  const bits = new Array<number>(32).fill(0);
  for (const t of tokens) {
    let h = 0;
    for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) >>> 0;
    for (let b = 0; b < 32; b++) bits[b] += h & (1 << b) ? 1 : -1;
  }
  let out = 0;
  for (let b = 0; b < 32; b++) if (bits[b] > 0) out |= 1 << b;
  return (out >>> 0).toString(16).padStart(8, '0');
}

export function crawlQualityScore(opts: {
  textLength: number;
  headingCount: number;
  boilerplateRatio?: number;
}): number {
  let score = 0;
  if (opts.textLength >= 800) score += 40;
  else if (opts.textLength >= 300) score += 20;
  if (opts.headingCount >= 3) score += 30;
  else if (opts.headingCount >= 1) score += 15;
  const boiler = opts.boilerplateRatio ?? 0;
  score += Math.max(0, 30 - Math.round(boiler * 30));
  return Math.min(100, score);
}

export async function upsertCompetitorDocuments(
  corpusId: string,
  docs: Array<{ url: string; html?: string; text?: string }>,
): Promise<number> {
  await ensureCorpusTables();
  let n = 0;
  for (const d of docs) {
    const url = (d.url || '').trim();
    if (!url) continue;
    const text = (d.text || d.html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const html = d.html || '';
    const headingCount = (html.match(/<h[1-6][\s>]/gi) || []).length;
    const quality = crawlQualityScore({ textLength: text.length, headingCount });
    await db.query(
      `INSERT INTO competitor_documents
        (corpus_id, url, content_md, content_hash, quality_score, simhash)
       VALUES (?, ?, ?, ?, ?, ?)`,
      {
        replacements: [
          corpusId,
          url,
          text.slice(0, 100_000),
          contentHash(text),
          quality,
          simhash(text),
        ],
      },
    );
    n += 1;
  }
  return n;
}
