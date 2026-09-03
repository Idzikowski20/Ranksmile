/**
 * "Building brand profiles" phase — turn the per-answer brand mentions into one row per
 * brand, which is what the Competitors view reads.
 *
 * Extraction (aiVisibilityBrands) answers "who is named in this one answer". This phase
 * answers "how does each brand stand across the whole scan": how often it is mentioned,
 * where it lands in the answer, and a presence index. The reference tool exposes exactly
 * that triple per brand (mention rate, average position, presence score), so the profile
 * is stored in the same shape rather than recomputed differently on every read.
 *
 * Chunked and idempotent: the aggregate is recomputed each call and only brands without a
 * row yet are written, so a tick that dies mid-way simply resumes.
 */
import db from '@/database/database';
import { queryOne, queryRows } from '@/src/infrastructure/db/query';
import { parseBrands } from '@/src/infrastructure/aiVisibility/aiVisibilityRead';
import type { BrandMention } from '@/src/core/domain/aiVisibility/metricsTypes';
import { presenceScore } from '@/src/core/domain/aiVisibility/presence';
import { brandKey } from '@/src/core/domain/aiVisibility/metricsOverview';

export type ProfileChunkResult = { done: number; remaining: number };
export const AI_VIS_PROFILE_CHUNK = 25;

type Agg = {
   brand: string;
   domain: string;
   mentions: number;
   posSum: number;
   sentiments: BrandMention['sentiment'][];
};

/** A duplicate-key race between two ticks is expected; other persistence errors are not. */
const isDuplicateKey = (e: unknown): boolean => /duplicate|unique/i.test(e instanceof Error ? e.message : String(e));

/** The sentiment the answers most often carried for this brand. */
function dominantSentiment(list: BrandMention['sentiment'][]): string {
   const counts = new Map<string, number>();
   for (const s of list) counts.set(s, (counts.get(s) ?? 0) + 1);
   let best = 'neutral';
   let n = -1;
   for (const [s, c] of counts) if (c > n) { best = s; n = c; }
   return best;
}

/**
 * Build up to `limit` missing brand profiles for a scan.
 *
 * presence_score uses the shared calibrated model (domain/aiVisibility/presence), the same
 * one the own-brand gauge reads, so a competitor's number and ours are on one scale — and
 * on the reference tool's scale.
 */
export async function runProfileChunk(scanId: number, limit = AI_VIS_PROFILE_CHUNK): Promise<ProfileChunkResult> {
   // Denominator and precision must match rankBrandProfiles/computeBrandOverview exactly:
   // this table is a cache of the same metric, and Competitors reads it when no filter is
   // set but recomputes live when one is. A different rule here made toggling an empty
   // filter change the numbers.
   const pairsRow = await queryOne<{ n: number }>(
      'SELECT COUNT(*) AS n FROM ai_vis_results WHERE scan_id = ? AND error IS NULL AND brands IS NOT NULL',
      [scanId],
   );
   const pairs = Number(pairsRow?.n ?? 0);

   const rows = await queryRows<{ brands: unknown }>(
      'SELECT brands FROM ai_vis_results WHERE scan_id = ? AND error IS NULL AND brands IS NOT NULL',
      [scanId],
   );

   const agg = new Map<string, Agg>();
   for (const r of rows) {
      // Key and per-answer dedupe must match rankBrandProfiles — this table is a cache of
      // exactly that computation.
      const seen = new Set<string>();
      for (const b of parseBrands(r.brands)) {
         const key = brandKey(b.brand);
         if (!key || seen.has(key)) continue;
         seen.add(key);
         const e = agg.get(key) ?? { brand: b.brand.trim(), domain: b.domain, mentions: 0, posSum: 0, sentiments: [] };
         e.mentions += 1;
         e.posSum += b.pos;
         if (!e.domain && b.domain) e.domain = b.domain;
         e.sentiments.push(b.sentiment);
         agg.set(key, e);
      }
   }

   const built = await queryRows<{ brand: string }>('SELECT brand FROM ai_vis_brand_profiles WHERE scan_id = ?', [scanId]);
   const have = new Set(built.map((b) => brandKey(String(b.brand))));
   const pending = [...agg.entries()].filter(([key]) => !have.has(key));
   const batch = pending.slice(0, limit);

   if (batch.length) {
      const values = batch.map(() => '(?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)').join(', ');
      const params = batch.flatMap(([, e]) => {
         const avgPosition = e.mentions ? Math.round((e.posSum / e.mentions) * 10) / 10 : null;
         const mentionRate = pairs ? Math.round((e.mentions / pairs) * 1000) / 10 : 0;
         return [scanId, e.brand, e.domain || null, e.mentions, avgPosition,
            presenceScore({ mentionRate, avgPosition }), dominantSentiment(e.sentiments)];
      });
      // One statement instead of 25 sequential round trips. A duplicate is a concurrent
      // tick winning the race on the unique (scan_id, brand) index — not a failure.
      await db.query(
         `INSERT INTO ai_vis_brand_profiles (scan_id, brand, domain, mentions, avg_position, presence_score, sentiment, updated_at)
          VALUES ${values}`,
         { replacements: params },
      ).catch((e: unknown) => { if (!isDuplicateKey(e)) throw e; });
   }

   const remaining = pending.length - batch.length;
   // Terminal marker — see ai_vis_scans.profiles_done_at. A scan whose answers named no
   // brands has nothing to write, and "zero profiles" must not read as "still working".
   if (!remaining) {
      await db.query(
         'UPDATE ai_vis_scans SET profiles_done_at = CURRENT_TIMESTAMP WHERE id = ? AND profiles_done_at IS NULL',
         { replacements: [scanId] },
      );
   }
   return { done: batch.length, remaining };
}

/** Latest completed scan per config whose answers carry brands worth profiling. */
export async function findScansNeedingProfiles(limit = 5): Promise<Array<{ scanId: number }>> {
   return queryRows<{ scanId: number }>(
      `SELECT s.id AS "scanId"
       FROM ai_vis_scans s
       JOIN (SELECT config_id, MAX(finished_at) AS mx FROM ai_vis_scans WHERE status = 'completed' GROUP BY config_id) latest
         ON latest.config_id = s.config_id AND latest.mx = s.finished_at
       WHERE s.status = 'completed'
         AND s.profiles_done_at IS NULL
         AND EXISTS (SELECT 1 FROM ai_vis_results r WHERE r.scan_id = s.id AND r.brands IS NOT NULL)
         AND NOT EXISTS (SELECT 1 FROM ai_vis_results r2 WHERE r2.scan_id = s.id AND r2.brands IS NULL AND r2.error IS NULL AND r2.answer IS NOT NULL)
       ORDER BY s.finished_at DESC LIMIT ?`,
      [limit],
   );
}
