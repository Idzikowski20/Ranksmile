/**
 * Topic Research runner — mirrors lib/auditRunner.ts.
 * enqueueTopicResearch → upsert queued row; processQueuedForDomain drains the queue.
 */
import db from '../database/database';
import { queryOne } from './db/query';
import { getErrorMessage } from './errors';
import { isQueueRunnerEnabled } from './featureFlags';
import {
  affectedRows,
  enqueueQueueRun,
  processQueueForDomain,
  type QueueRunnerConfig,
} from './queueRunner';
import { isDataForSeoConfigured } from './dataforseo';
import { getKeywordIdeas, getKeywordSuggestions } from './seo/keywordData';
import { getRankedKeywords } from './dataforseo';
import { langForCountry } from './countryLang';
import {
   assembleResult,
   clusterKeywords,
   type EnrichedKeyword,
} from './topicClustering';
import type { TopicResearchResult, TopicResearchStats } from './topicResearchTypes';

const isPg = !!process.env.DATABASE_URL;
const STALE_SECS = 5 * 60;

const ON_CONFLICT = `ON CONFLICT (domain_id, seed, country) DO UPDATE SET
   status = 'queued', result_json = NULL, stats_json = NULL, error = NULL,
   progress_done = 0, progress_total = 1,
   started_at = NULL, finished_at = NULL, created_at = CURRENT_TIMESTAMP`;

const TOPIC_QUEUE: QueueRunnerConfig = {
  table: 'topic_research_runs',
  onConflict: ON_CONFLICT,
  staleSecs: STALE_SECS,
  runJob: async (row, domainHost) => {
    const { result, stats } = await computeTopicResearch(row.seed, row.country, domainHost);
    return { resultJson: JSON.stringify(result), statsJson: JSON.stringify(stats) };
  },
};

export async function enqueueTopicResearch(domainId: number, seed: string, country: string): Promise<number> {
   if (isQueueRunnerEnabled()) {
      return enqueueQueueRun(TOPIC_QUEUE, domainId, seed, country);
   }
   const cols = 'domain_id, seed, country, status, progress_done, progress_total';
   const values = "VALUES (?, ?, ?, 'queued', 0, 1)";
   const repl = [domainId, seed.trim(), country.toUpperCase()];
   if (isPg) {
      const created = await queryOne<{ id: number }>(
         `INSERT INTO topic_research_runs (${cols}) ${values} ${ON_CONFLICT} RETURNING id`,
         repl,
      );
      if (!created) throw new Error('Failed to enqueue topic research');
      return created.id;
   }
   await db.query(
      `INSERT INTO topic_research_runs (${cols}) ${values} ${ON_CONFLICT}`,
      { replacements: repl },
   );
   const created = await queryOne<{ id: number }>(
      'SELECT id FROM topic_research_runs WHERE domain_id = ? AND seed = ? AND country = ? LIMIT 1',
      [domainId, seed.trim(), country.toUpperCase()],
   );
   if (!created) throw new Error('Failed to enqueue topic research');
   return created.id;
}

async function expandKeywords(seed: string, country: string): Promise<EnrichedKeyword[]> {
   if (!isDataForSeoConfigured()) {
      throw new Error('DataForSEO is not configured (DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD)');
   }
   const lang = langForCountry(country);

   const [suggestions, ideas] = await Promise.all([
      getKeywordSuggestions({ seed, country, languageCode: lang, limit: 200 }),
      getKeywordIdeas({ seed, country, languageCode: lang, limit: 200 }),
   ]);

   const seen = new Map<string, EnrichedKeyword>();
   const add = (k: { keyword: string; search_volume: number | null; keyword_difficulty: number | null }) => {
      const key = k.keyword.toLowerCase().trim();
      if (!key || seen.has(key)) return;
      seen.set(key, {
         keyword: k.keyword.trim(),
         volume: k.search_volume,
         kd: k.keyword_difficulty,
         position: null,
      });
   };

   for (const k of suggestions.keywords) add(k);
   for (const k of ideas.keywords) add(k);

   // Ensure seed is included
   const seedKey = seed.toLowerCase().trim();
   if (!seen.has(seedKey)) {
      seen.set(seedKey, { keyword: seed.trim(), volume: null, kd: null, position: null });
   }

   return Array.from(seen.values()).sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0));
}

async function attachPositions(keywords: EnrichedKeyword[], domainHost: string, country: string): Promise<void> {
   const lang = langForCountry(country);
   const ranked = await getRankedKeywords({
      target: domainHost,
      country,
      languageCode: lang,
      limit: 500,
      maxRankGroup: 50,
   });
   const posMap = new Map<string, number>();
   for (const r of ranked) {
      if (r.position != null && r.position > 0) {
         posMap.set(r.keyword.toLowerCase(), r.position);
      }
   }
   for (const kw of keywords) {
      const p = posMap.get(kw.keyword.toLowerCase());
      if (p != null) kw.position = p;
   }
}

export async function computeTopicResearch(
   seed: string,
   country: string,
   domainHost: string,
): Promise<{ result: TopicResearchResult; stats: TopicResearchStats }> {
   const keywords = await expandKeywords(seed, country);
   if (keywords.length < 3) {
      throw new Error('Not enough keyword ideas returned for this seed. Try a broader topic.');
   }

   await attachPositions(keywords, domainHost, country);

   const rawClusters = await clusterKeywords(seed, keywords);
   const result = assembleResult(seed, country, rawClusters, keywords);
   return { result, stats: result.stats };
}

export async function processQueuedForDomain(domainId: number, budgetMs = 45000): Promise<number> {
   if (isQueueRunnerEnabled()) {
      const n = await processQueueForDomain(TOPIC_QUEUE, domainId, budgetMs);
      return Math.max(0, n);
   }

   const deadline = Date.now() + budgetMs;
   let processed = 0;

   await db.query(
      isPg
         ? `UPDATE topic_research_runs SET status = 'queued', started_at = NULL
             WHERE domain_id = ? AND status = 'running' AND started_at < NOW() - INTERVAL '${STALE_SECS} seconds'`
         : `UPDATE topic_research_runs SET status = 'queued', started_at = NULL
             WHERE domain_id = ? AND status = 'running' AND started_at < datetime('now', '-${STALE_SECS} seconds')`,
      { replacements: [domainId] },
   ).catch(() => { /* best-effort reclaim */ });

   const domainRow = await queryOne<{ domain: string }>(
      'SELECT domain FROM domain WHERE "ID" = ? LIMIT 1',
      [domainId],
   );
   const domainHost = domainRow?.domain ?? '';

   for (let i = 0; i < 100000; i += 1) {
      if (Date.now() >= deadline) break;
      const candidate = isPg
         ? await queryOne<{ id: number; seed: string; country: string }>(
            `UPDATE topic_research_runs SET status = 'running', started_at = CURRENT_TIMESTAMP, progress_done = 0, progress_total = 1
             WHERE id = (
               SELECT id FROM topic_research_runs
               WHERE domain_id = ? AND status = 'queued'
               ORDER BY id ASC LIMIT 1
               FOR UPDATE SKIP LOCKED
             )
             RETURNING id, seed, country`,
            [domainId],
         )
         : await queryOne<{ id: number; seed: string; country: string }>(
            "SELECT id, seed, country FROM topic_research_runs WHERE domain_id = ? AND status = 'queued' ORDER BY id ASC LIMIT 1",
            [domainId],
         );
      if (!candidate) break;

      if (!isPg) {
         const claim = await db.query(
            "UPDATE topic_research_runs SET status = 'running', started_at = CURRENT_TIMESTAMP, progress_done = 0, progress_total = 1 WHERE id = ? AND status = 'queued'",
            { replacements: [candidate.id] },
         );
         if (affectedRows(claim) === 0) continue;
      }

      try {
         const { result, stats } = await computeTopicResearch(candidate.seed, candidate.country, domainHost);
         await db.query(
            "UPDATE topic_research_runs SET status = 'completed', result_json = ?, stats_json = ?, progress_done = 1, progress_total = 1, finished_at = CURRENT_TIMESTAMP WHERE id = ?",
            { replacements: [JSON.stringify(result), JSON.stringify(stats), candidate.id] },
         );
      } catch (e) {
         await db.query(
            "UPDATE topic_research_runs SET status = 'failed', error = ?, finished_at = CURRENT_TIMESTAMP WHERE id = ?",
            { replacements: [getErrorMessage(e), candidate.id] },
         ).catch(() => { /* best effort */ });
      }
      processed += 1;
   }
   return processed;
}
