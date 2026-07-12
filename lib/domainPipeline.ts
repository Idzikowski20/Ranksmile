import { randomUUID } from 'crypto';
import { QueryTypes, type Transaction } from 'sequelize';
import db from '../database/database';
import { ensurePipelineTables } from './ensurePipelineTables';
import { gatherBlogUrls } from './gatherBlogUrls';
import { getSiteAuditPageLimit, resolvePlanSlug } from './planLimits';
import { getOrgBillingState } from './orgBilling';
import { ensureUserTenancy } from './tenancy';

export type StageKey = 'gsc' | 'keywords' | 'topics' | 'competitors' | 'recommendations';
export const STAGE_ORDER: StageKey[] = ['gsc', 'keywords', 'topics', 'competitors', 'recommendations'];
const STALE_MS = 10 * 60 * 1000;

export interface PageAuditResult {
   url: string; path?: string; title?: string; score?: number; word_count?: number;
   signals?: unknown; content_hash?: string; fetch_status?: string; duration_ms?: number;
}
type DomainResult = {
   keywords: { keyword: string; source: string; volume?: number; position?: number }[];
   topics: { title: string; summary?: string }[];
   competitors: { competitor_domain: string; appearances?: number; avg_position?: number }[];
   recommendations: { title: string; rationale?: string; priority?: string; type?: string; topic_index?: number; url?: string; score?: number }[];
   page_audits?: PageAuditResult[];
   audit_counts?: { audited: number; skipped: number; total: number };
};

// The sidecar runs a hidden 'blog_audit' stage between 'competitors' and
// 'recommendations' that has no UI row. Fold it into 'competitors' (whose label is
// "…and coverage") so the in-between poll doesn't map to index -1 and reset every
// row to pending — which blanked the checkmarks/spinner for ~2s.
const STAGE_ALIASES: Record<string, StageKey> = { blog_audit: 'competitors' };

/** Pure: maps job status/current_stage to the 5-row UI map + active stagePercent. */
export function deriveStages(status: string, currentStage: string | null, stagePercent: number) {
   const done = status === 'done';
   const effectiveStage = currentStage ? (STAGE_ALIASES[currentStage] ?? currentStage) : null;
   const curIdx = effectiveStage ? STAGE_ORDER.indexOf(effectiveStage as StageKey) : -1;
   const stages = {} as Record<StageKey, 'pending' | 'running' | 'done'>;
   STAGE_ORDER.forEach((k, i) => {
      if (done) stages[k] = 'done';
      else if (i < curIdx) stages[k] = 'done';
      else if (i === curIdx) stages[k] = 'running';
      else stages[k] = 'pending';
   });
   return { stages, stagePercent: done ? 100 : stagePercent };
}

async function selectRows<T extends object>(sql: string, repl: unknown[]): Promise<T[]> {
   return db.query<T>(sql, { replacements: repl, type: QueryTypes.SELECT });
}

/**
 * Idempotent + race-safe. The job id is DETERMINISTIC (`dsetup_<domainId>`), so two
 * concurrent enqueues collide on the PRIMARY KEY — the loser's INSERT throws, is caught,
 * and re-reads the winner's row. (One-shot per domain; a future manual re-run would
 * replace this row — out of scope here.) This is the analogue of the foundation's
 * UNIQUE-serialized provisioning: never two jobs for the same domain.
 */
export async function enqueueDomainSetup(domainId: number): Promise<string> {
   await ensurePipelineTables();
   const jobId = `dsetup_${domainId}`;
   const existing = await selectRows<{ id: string }>(
      `SELECT id FROM analysis_jobs WHERE id = ?`, [jobId]);
   if (existing.length) return jobId; // already enqueued (queued/running/done) — reuse
   try {
      // article_id = 0 sentinel: analysis_jobs.article_id is NOT NULL on SQLite (the
      // dev fallback) and can't be dropped there; domain jobs are keyed by domain_id +
      // job_type, never by article_id, so a 0 sentinel is harmless on both dialects.
      await db.query(
         `INSERT INTO analysis_jobs (id, article_id, domain_id, job_type, status, created_at, updated_at)
          VALUES (?, 0, ?, 'domain_setup', 'queued', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
         { replacements: [jobId, domainId] });
   } catch (e) {
      // A PK/unique collision means a concurrent enqueue already inserted the winner — fine.
      // Anything else (permission, connection, schema) is a real failure — surface it, don't mask.
      const m = e instanceof Error ? e.message : String(e);
      if (!/unique|duplicate|primary key/i.test(m)) throw e;
   }
   return jobId;
}

/** Atomic claim: conditional UPDATE + dialect-safe SELECT-back. true only if we own it. */
export async function claimJob(jobId: string, token: string): Promise<boolean> {
   const staleCutoffIso = new Date(Date.now() - STALE_MS).toISOString();
   await db.query(
      `UPDATE analysis_jobs
         SET status='running', locked_at=CURRENT_TIMESTAMP, locked_by=?, attempts=attempts+1, updated_at=CURRENT_TIMESTAMP
       WHERE id=? AND attempts < max_attempts
         AND (status IN ('queued','failed') OR (status='running' AND locked_at < ?))`,
      { replacements: [token, jobId, staleCutoffIso] });
   const back = await selectRows<{ status: string; locked_by: string }>(
      `SELECT status, locked_by FROM analysis_jobs WHERE id = ?`, [jobId]);
   return back.length > 0 && back[0].status === 'running' && back[0].locked_by === token;
}

/** Single materialization point — one transaction, delete-first, then insert. */
export async function materializeDomainSetup(domainId: number, result: DomainResult): Promise<void> {
   await db.transaction(async (tx: Transaction) => {
      const q = (sql: string, repl: unknown[]) => db.query(sql, { replacements: repl, transaction: tx });
      for (const t of ['domain_keywords', 'domain_topics', 'domain_competitors', 'domain_recommendations']) {
         await q(`DELETE FROM ${t} WHERE domain_id = ?`, [domainId]);
      }
      const topicIds: number[] = [];
      for (const t of result.topics || []) {
         await q(`INSERT INTO domain_topics (domain_id, title, summary, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)`, [domainId, t.title, t.summary || '']);
         const back = await db.query<{ id: number }>(`SELECT id FROM domain_topics WHERE domain_id = ? ORDER BY id DESC LIMIT 1`, { replacements: [domainId], type: QueryTypes.SELECT, transaction: tx });
         topicIds.push(back[0]?.id ?? 0);
      }
      for (const k of result.keywords || [])
         await q(`INSERT INTO domain_keywords (domain_id, keyword, source, volume, position, created_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`, [domainId, k.keyword, k.source || 'suggest', k.volume ?? null, k.position ?? null]);
      for (const c of result.competitors || [])
         await q(`INSERT INTO domain_competitors (domain_id, competitor_domain, appearances, avg_position, created_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`, [domainId, c.competitor_domain, c.appearances ?? 0, c.avg_position ?? null]);

      // ── page_audits: UPSERT-by-(domain_id,url), keep deep_json across scans ──
      const existingRows = await db.query<{ url: string }>(
         `SELECT url FROM page_audits WHERE domain_id = ?`,
         { replacements: [domainId], type: QueryTypes.SELECT, transaction: tx },
      );
      const existingUrls = new Set(existingRows.map((r) => r.url));
      const incomingUrls = new Set((result.page_audits || []).map((a) => a.url));
      for (const a of result.page_audits || []) {
         if (existingUrls.has(a.url)) {
            // refresh triage columns only — deep_json/deep_content_hash/deep_generated_at/status untouched
            await q(
               `UPDATE page_audits SET path=?, title=?, score=?, word_count=?, signals_json=?,
                       fetch_status=?, content_hash=?, duration_ms=?, last_audited_at=CURRENT_TIMESTAMP
                WHERE domain_id=? AND url=?`,
               [a.path ?? null, a.title ?? null, a.score ?? null, a.word_count ?? null,
                a.signals ? JSON.stringify(a.signals) : null, a.fetch_status ?? null,
                a.content_hash ?? null, a.duration_ms ?? null, domainId, a.url],
            );
         } else {
            await q(
               `INSERT INTO page_audits (domain_id, url, path, title, score, word_count, signals_json,
                       fetch_status, content_hash, duration_ms, status, last_audited_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'triaged', CURRENT_TIMESTAMP)`,
               [domainId, a.url, a.path ?? null, a.title ?? null, a.score ?? null, a.word_count ?? null,
                a.signals ? JSON.stringify(a.signals) : null, a.fetch_status ?? null,
                a.content_hash ?? null, a.duration_ms ?? null],
            );
         }
      }
      // Empty audits usually mean discovery/fetch failed; do not treat that as "all pages removed".
      if (incomingUrls.size > 0) {
         // delete ONLY rows whose URL no longer exists on the site
         for (const url of existingUrls)
            if (!incomingUrls.has(url))
               await q(`DELETE FROM page_audits WHERE domain_id=? AND url=?`, [domainId, url]);
      }

      for (const r of result.recommendations || [])
         await q(`INSERT INTO domain_recommendations (domain_id, topic_id, title, rationale, priority, type, url, score, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`, [domainId, r.topic_index != null ? topicIds[r.topic_index] ?? null : null, r.title, r.rationale || '', r.priority || 'medium', r.type || 'content', r.url ?? null, r.score ?? null]);
   });
}

// ── Integration orchestration (GSC + sidecar kick) ────────────────────────

import GscAccount from '../database/models/gscAccount';
import { buildOAuthClientFromAccount } from './gscAccounts';
import { searchconsole_v1 } from '@googleapis/searchconsole';

const sidecarBase = () => process.env.PYTHON_SIDECAR_URL || process.env.SIDECAR_URL || 'http://127.0.0.1:8000';
const selfUrl = () => process.env.NEXTJS_URL || 'http://127.0.0.1:3000';

async function emit(jobId: string, stage: StageKey, percent: number, message: string) {
   try {
      await fetch(`${selfUrl()}/api/articles/job-progress`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json', 'x-internal-token': process.env.INTERNAL_PIPELINE_TOKEN || '' },
         body: JSON.stringify({ jobId, currentStage: stage, stageProgress: percent, totalProgress: Math.round((STAGE_ORDER.indexOf(stage) * 100 + percent) / STAGE_ORDER.length), message }),
      });
   } catch { /* progress is best-effort */ }
}

async function failJob(jobId: string, stage: StageKey, message: string) {
   await db.query(`UPDATE analysis_jobs SET status='failed', current_stage=?, error=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`, { replacements: [stage, message, jobId] });
}

/** Stage 1 (Node): GSC fetch + seed fallback. Returns seed keywords + top page URLs. */
async function gscStageAndSeeds(jobId: string, domainId: number): Promise<{ seeds: string[]; pages: string[] }> {
   await emit(jobId, 'gsc', 10, 'Getting Search Console and site data');
   // Resolve domain + userId from the domain row.
   const drows = await selectRows<{ domain: string; userId: string }>(`SELECT domain, "userId" FROM domain WHERE "ID" = ? LIMIT 1`, [domainId]);
   const domainName = drows[0]?.domain || '';
   const userId = drows[0]?.userId || '';
   let seeds: string[] = [];
   let pages: string[] = [];
   try {
      const accounts = (await GscAccount.findAll({ where: { userId } })).map((a) => a.get({ plain: true }));
      for (const acc of accounts) {
         try {
            const client = new searchconsole_v1.Searchconsole({ auth: buildOAuthClientFromAccount(acc) });
            const end = new Date(); const start = new Date(); start.setDate(start.getDate() - 30);
            const fmt = (d: Date) => d.toISOString().slice(0, 10);
            // try both URL-prefix and sc-domain property forms
            for (const siteUrl of [`https://${domainName}/`, `sc-domain:${domainName}`]) {
               try {
                  const r = await client.searchanalytics.query({ siteUrl, requestBody: { startDate: fmt(start), endDate: fmt(end), dimensions: ['query'], rowLimit: 50 } });
                  const rows = r.data.rows || [];
                  if (rows.length) {
                     seeds = rows.map((x) => (x.keys || [])[0]).filter((k): k is string => typeof k === 'string');
                     // Same property works → also pull top pages (audit fallback when no sitemap).
                     try {
                        const pr = await client.searchanalytics.query({ siteUrl, requestBody: { startDate: fmt(start), endDate: fmt(end), dimensions: ['page'], rowLimit: 100 } });
                        pages = (pr.data.rows || []).map((x) => (x.keys || [])[0]).filter((k): k is string => typeof k === 'string');
                     } catch { /* pages optional */ }
                     break;
                  }
               } catch { /* try next form */ }
            }
            if (seeds.length) break;
         } catch { /* try next account */ }
      }
   } catch { /* GSC optional */ }
   if (!seeds.length) {
      // Fallback: site_context title/description, then brand_knowledge.
      const ctx = await selectRows<{ title: string; description: string }>(`SELECT title, description FROM site_context WHERE domain_id = ? LIMIT 1`, [domainId]);
      const bk = await selectRows<{ brand_knowledge: string }>(`SELECT brand_knowledge FROM domain WHERE "ID" = ? LIMIT 1`, [domainId]);
      const text = [ctx[0]?.title, ctx[0]?.description, (bk[0]?.brand_knowledge || '').slice(0, 400)].filter(Boolean).join(' ');
      seeds = text ? [domainName.split('.')[0], ...text.split(/[^a-zA-Z0-9ąćęłńóśźż]+/).filter((w) => w.length > 4)].slice(0, 8) : [domainName.split('.')[0]];
   }
   await emit(jobId, 'gsc', 100, 'Search Console and site data ready');
   return { seeds: Array.from(new Set(seeds)).slice(0, 30), pages: Array.from(new Set(pages)) };
}

/** Fire-and-forget runner. Claims, runs GSC, calls sidecar; sidecar finishes via job-progress 'done'. */
export async function kickDomainSetup(jobId: string): Promise<void> {
   const token = `nextjs_${process.pid || 'x'}_${randomUUID()}`;
   if (!(await claimJob(jobId, token))) return; // someone else owns it / exhausted
   const jrows = await selectRows<{ domain_id: number; payload: string }>(`SELECT domain_id, payload FROM analysis_jobs WHERE id = ?`, [jobId]);
   const domainId = Number(jrows[0]?.domain_id);
   if (!domainId) { await failJob(jobId, 'gsc', 'missing domain_id'); return; }
   try {
      const { seeds: seedKeywords, pages: gscPages } = await gscStageAndSeeds(jobId, domainId);
      const drows = await selectRows<{ domain: string; brand_knowledge: string }>(`SELECT domain, brand_knowledge FROM domain WHERE "ID" = ? LIMIT 1`, [domainId]);
      const domainName = drows[0]?.domain || '';
      let blogUrls = await gatherBlogUrls(domainId, domainName);
      // No sitemap (or nothing matched) → fall back to the domain's top GSC pages.
      if (!blogUrls.length && gscPages.length) {
         blogUrls = Array.from(new Set(gscPages.map((u) => u.split('#')[0].split('?')[0])));
      }
      const langRow = await selectRows<{ language: string }>(`SELECT language FROM site_context WHERE domain_id = ? ORDER BY id LIMIT 1`, [domainId]);
      const language = langRow[0]?.language || 'pl';
      const ownerRow = await selectRows<{ userId: string }>(`SELECT "userId" FROM domain WHERE "ID" = ? LIMIT 1`, [domainId]);
      let siteAuditPages = 100;
      try {
         const ownerId = ownerRow[0]?.userId;
         if (ownerId) {
            const { orgId } = await ensureUserTenancy(ownerId);
            const billing = await getOrgBillingState(orgId);
            siteAuditPages = getSiteAuditPageLimit(resolvePlanSlug(billing?.planSlug));
         }
      } catch { /* default 100 */ }
      const body = { jobId, nextjsUrl: selfUrl(), payload: { domainId, domain: domainName, seedKeywords, brandKnowledge: drows[0]?.brand_knowledge || '', blog_urls: blogUrls, language, limits: { keywords: 20, competitorsPerKeyword: 10, site_audit_pages: siteAuditPages } } };
      const resp = await fetch(`${sidecarBase()}/pipeline/domain-setup`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-internal-token': process.env.INTERNAL_PIPELINE_TOKEN || '' }, body: JSON.stringify(body) });
      if (!resp.ok) await failJob(jobId, 'keywords', `sidecar ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
      // On success the sidecar will POST status='done' + result to job-progress, which materializes.
   } catch (e) {
      await failJob(jobId, 'gsc', (e instanceof Error ? e.message : String(e)) || 'pipeline error');
   }
}

/** For setup-status: latest domain_setup job + derived stages. */
export async function getSetupStatus(domainId: number) {
   await ensurePipelineTables();
   const rows = await selectRows<{ status: string; current_stage: string | null; stage_progress: number | null; error: string | null; result: string | Record<string, unknown> | null }>(
      `SELECT status, current_stage, stage_progress, error, result FROM analysis_jobs
       WHERE domain_id = ? AND job_type = 'domain_setup' ORDER BY created_at DESC LIMIT 1`, [domainId]);
   if (!rows.length) return { status: 'none' as const, currentStage: null, stagePercent: 0, stages: deriveStages('none', null, 0).stages, error: null, auditCounts: null };
   const j = rows[0];
   const d = deriveStages(j.status, j.current_stage, j.stage_progress ?? 0);
   // audit_counts is carried inside the job's stored result JSON (no extra column needed).
   // result is JSONB (parsed object) on Postgres, TEXT (string) on SQLite — handle both.
   let auditCounts: { audited: number; skipped: number; total: number } | null = null;
   try {
      const parsed = typeof j.result === 'string' ? JSON.parse(j.result) : j.result;
      const ac = parsed && (parsed as Record<string, unknown>).audit_counts;
      if (ac && typeof ac === 'object') auditCounts = ac as { audited: number; skipped: number; total: number };
   } catch { auditCounts = null; }
   return { status: j.status, currentStage: j.current_stage, stagePercent: d.stagePercent, stages: d.stages, error: j.error, auditCounts };
}
