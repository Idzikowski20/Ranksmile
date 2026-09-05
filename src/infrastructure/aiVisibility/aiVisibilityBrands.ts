/**
 * Brand extraction for AI Visibility Sources. Pulls the brands/companies an AI
 * answer names (with sentiment + quotes) out of the STORED answer text — we do not
 * scrape the cited pages. Pure helpers (prompt/parse) are unit-tested; the DB-driven
 * chunk mirrors runScanChunk (resumable, idempotent, per-row best effort).
 */
import { llmGateway } from '@/src/infrastructure/ai/llmGateway';
import { getErrorMessage } from '@/src/core/shared/errors';
import { queryOne, queryRows } from '@/src/infrastructure/db/query';
import db from '@/database/database';
import { buildBrandPrompt, parseBrandResponse, RawBrand } from '@/src/core/domain/aiVisibility/brands';

// Re-export the pure brand helpers (now src/core/domain/aiVisibility/brands) so
// callers keep a single import surface. Tests hit the domain module directly to
// avoid pulling in the ESM-only @ai-sdk/deepseek client.
export { buildBrandPrompt, parseBrandResponse } from '@/src/core/domain/aiVisibility/brands';
export type { RawBrand } from '@/src/core/domain/aiVisibility/brands';

/**
 * Through the shared gateway (OpenRouter first), not a direct provider call.
 *
 * This used to call DeepSeek directly and swallow every error, so when that account ran out
 * of balance the phase stopped dead — each answer failed, its row stayed NULL, the "answers
 * left" count never moved, and nothing was written to the log to say why. The gateway falls
 * through to its other providers, and a failure is now reported.
 */
export async function extractBrandsForRow(answer: string, ownBrand: string): Promise<RawBrand[] | null> {
   try {
      const gw = await llmGateway({
         provider: 'openrouter',
         maxTokens: 900,
         jobType: 'ai_vis_brand_extract',
         messages: [{ role: 'user', content: buildBrandPrompt(answer, ownBrand) }],
      });
      return parseBrandResponse(gw.text);
   } catch (e) {
      // Loud on purpose: leaving the row NULL is the retry, but a phase that cannot make
      // progress must say so rather than spin.
      console.warn('[ai_vis_brands] extraction failed:', getErrorMessage(e));
      return null;
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
      // An empty answer names nobody, and there is nothing for a model to read. Recording
      // that directly keeps ten empty ai_overview rows from spending ten calls a pass —
      // and from stalling the phase if the model rejects an empty prompt.
      // eslint-disable-next-line no-await-in-loop
      const brands = row.answer?.trim() ? await extractBrandsForRow(row.answer, ownBrand) : [];
      if (brands === null) continue; // keep NULL, retry next time
      await db.query('UPDATE ai_vis_results SET brands = ? WHERE id = ? AND brands IS NULL', { replacements: [JSON.stringify(brands), row.id] }).catch(() => {});
   }
   const left = await queryOne<{ n: number }>(
      'SELECT COUNT(*) AS n FROM ai_vis_results WHERE scan_id = ? AND brands IS NULL AND error IS NULL AND answer IS NOT NULL',
      [scanId],
   );
   return { done: pending.length, remaining: Number(left?.n ?? 0) };
}

/** Latest completed scan per config that still has un-analysed answers (for backfill). */
export async function findConfigsNeedingBrands(limit = 5): Promise<Array<{ scanId: number; brandName: string }>> {
   return queryRows<{ scanId: number; brandName: string }>(
      // The scan's own brand, not the config's: extraction is asynchronous, and a rename
      // while it runs would otherwise tag answers with a name the read path never matches.
      `SELECT s.id AS "scanId", COALESCE(s.brand_name, c.brand_name) AS "brandName"
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
