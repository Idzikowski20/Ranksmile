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

export type ProfileChunkResult = { done: number; remaining: number };
export const AI_VIS_PROFILE_CHUNK = 25;

type Agg = {
   brand: string;
   domain: string;
   mentions: number;
   posSum: number;
   scoreSum: number;
   sentiments: BrandMention['sentiment'][];
};

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
 * presence_score mirrors the locked visibility model: a mention at position p is worth
 * max(0, 100 - (p-1)*15), averaged over EVERY (prompt × model) pair of the scan — so a
 * brand named first in half the answers scores about half of a brand named first in all
 * of them, the same way our own visibilityScore is built.
 */
export async function runProfileChunk(scanId: number, limit = AI_VIS_PROFILE_CHUNK): Promise<ProfileChunkResult> {
   const pairsRow = await queryOne<{ n: number }>('SELECT COUNT(*) AS n FROM ai_vis_results WHERE scan_id = ?', [scanId]);
   const pairs = Number(pairsRow?.n ?? 0);
   if (!pairs) return { done: 0, remaining: 0 };

   const rows = await queryRows<{ brands: unknown }>(
      'SELECT brands FROM ai_vis_results WHERE scan_id = ? AND brands IS NOT NULL',
      [scanId],
   );
   if (!rows.length) return { done: 0, remaining: 0 };

   const agg = new Map<string, Agg>();
   for (const r of rows) {
      for (const b of parseBrands(r.brands)) {
         const key = b.brand.trim().toLowerCase();
         if (!key) continue;
         const e = agg.get(key) ?? { brand: b.brand.trim(), domain: b.domain, mentions: 0, posSum: 0, scoreSum: 0, sentiments: [] };
         e.mentions += 1;
         e.posSum += b.pos;
         e.scoreSum += Math.max(0, 100 - (b.pos - 1) * 15);
         if (!e.domain && b.domain) e.domain = b.domain;
         e.sentiments.push(b.sentiment);
         agg.set(key, e);
      }
   }

   const built = await queryRows<{ brand: string }>('SELECT brand FROM ai_vis_brand_profiles WHERE scan_id = ?', [scanId]);
   const have = new Set(built.map((b) => String(b.brand).trim().toLowerCase()));
   const pending = [...agg.entries()].filter(([key]) => !have.has(key));
   const batch = pending.slice(0, limit);

   for (const [, e] of batch) {
      const avgPosition = e.mentions ? Math.round((e.posSum / e.mentions) * 10) / 10 : null;
      const presence = Math.round(e.scoreSum / pairs);
      // eslint-disable-next-line no-await-in-loop -- one small INSERT per brand; the unique
      // index on (scan_id, brand) makes a concurrent tick a no-op rather than a duplicate.
      await db.query(
         `INSERT INTO ai_vis_brand_profiles (scan_id, brand, domain, mentions, avg_position, presence_score, sentiment, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
         { replacements: [scanId, e.brand, e.domain || null, e.mentions, avgPosition, presence, dominantSentiment(e.sentiments)] },
      ).catch(() => {});
   }

   return { done: batch.length, remaining: pending.length - batch.length };
}

/** Latest completed scan per config whose answers carry brands worth profiling. */
export async function findScansNeedingProfiles(limit = 5): Promise<Array<{ scanId: number }>> {
   return queryRows<{ scanId: number }>(
      `SELECT s.id AS "scanId"
       FROM ai_vis_scans s
       JOIN (SELECT config_id, MAX(finished_at) AS mx FROM ai_vis_scans WHERE status = 'completed' GROUP BY config_id) latest
         ON latest.config_id = s.config_id AND latest.mx = s.finished_at
       WHERE s.status = 'completed'
         AND EXISTS (SELECT 1 FROM ai_vis_results r WHERE r.scan_id = s.id AND r.brands IS NOT NULL)
         AND NOT EXISTS (SELECT 1 FROM ai_vis_results r2 WHERE r2.scan_id = s.id AND r2.brands IS NULL AND r2.error IS NULL AND r2.answer IS NOT NULL)
       ORDER BY s.finished_at DESC LIMIT ?`,
      [limit],
   );
}
