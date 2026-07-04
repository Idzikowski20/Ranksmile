/**
 * Brand extraction for AI Visibility Sources. Pulls the brands/companies an AI
 * answer names (with sentiment + quotes) out of the STORED answer text — we do not
 * scrape the cited pages. Pure helpers (prompt/parse) are unit-tested; the DB-driven
 * chunk mirrors runScanChunk (resumable, idempotent, per-row best effort).
 */
import { generateText } from 'ai';
import { deepseek } from './ai/deepseek';
import { queryOne, queryRows } from './db/query';
import db from '../database/database';
import { buildBrandPrompt, parseBrandResponse, RawBrand } from './aiVisibilityBrandsPure';

// Re-export pure helpers so callers keep a single import surface. Tests hit
// aiVisibilityBrandsPure directly to avoid pulling in ESM-only @ai-sdk/deepseek.
export { buildBrandPrompt, parseBrandResponse } from './aiVisibilityBrandsPure';
export type { RawBrand } from './aiVisibilityBrandsPure';

export async function extractBrandsForRow(answer: string, ownBrand: string): Promise<RawBrand[] | null> {
   try {
      const { text } = await generateText({ model: deepseek('deepseek-chat'), prompt: buildBrandPrompt(answer, ownBrand), maxOutputTokens: 900 });
      return parseBrandResponse(text);
   } catch {
      return null; // leave the row NULL so a later tick retries
   }
}

export type BrandChunkResult = { done: number; remaining: number };
export const AI_VIS_BRAND_CHUNK = 20;

/** Analyse up to `limit` un-analysed answers of a scan; UPDATE ai_vis_results.brands.
 *  Idempotent (brands IS NULL only), per-row try/catch. Returns rows left to analyse. */
export async function runBrandChunk(scanId: number, ownBrand: string, limit = AI_VIS_BRAND_CHUNK): Promise<BrandChunkResult> {
   const pending = await queryRows<{ id: number, answer: string | null }>(
      `SELECT id, answer FROM ai_vis_results
       WHERE scan_id = ? AND brands IS NULL AND error IS NULL AND answer IS NOT NULL
       ORDER BY id LIMIT ?`,
      [scanId, limit],
   );
   for (const row of pending) {
      const brands = await extractBrandsForRow(row.answer || '', ownBrand);
      if (brands === null) continue; // keep NULL, retry next time
      await db.query('UPDATE ai_vis_results SET brands = ? WHERE id = ? AND brands IS NULL', { replacements: [JSON.stringify(brands), row.id] }).catch(() => {});
   }
   const left = await queryOne<{ n: number }>(
      "SELECT COUNT(*) AS n FROM ai_vis_results WHERE scan_id = ? AND brands IS NULL AND error IS NULL AND answer IS NOT NULL",
      [scanId],
   );
   return { done: pending.length, remaining: Number(left?.n ?? 0) };
}

/** Latest completed scan per config that still has un-analysed answers (for backfill). */
export async function findConfigsNeedingBrands(limit = 5): Promise<Array<{ scanId: number; brandName: string }>> {
   return queryRows<{ scanId: number; brandName: string }>(
      `SELECT s.id AS "scanId", c.brand_name AS "brandName"
       FROM ai_vis_scans s
       JOIN ai_vis_configs c ON c.id = s.config_id
       JOIN (SELECT config_id, MAX(finished_at) AS mx FROM ai_vis_scans WHERE status = 'completed' GROUP BY config_id) latest
         ON latest.config_id = s.config_id AND latest.mx = s.finished_at
       WHERE s.status = 'completed'
         AND EXISTS (SELECT 1 FROM ai_vis_results r WHERE r.scan_id = s.id AND r.brands IS NULL AND r.error IS NULL AND r.answer IS NOT NULL)
       ORDER BY s.finished_at DESC LIMIT ?`,
      [limit],
   );
}
