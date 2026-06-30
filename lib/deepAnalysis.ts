// Shared deep-analysis core (P3d). Both the per-article SSE handler
// (pages/api/articles/deep-analysis.ts) and the on-demand page-audit endpoint
// (pages/api/domains/[slug]/page-audit-deep.ts) call the SAME sidecar path
// (/pipeline/deep-analysis) — this module is the single place that does it so the
// two callers can't drift on payload shape, timeout, or result parsing.
import { sidecarBase } from './sidecar';

/** One signal of the hybrid ranking rubric (meta_quality, content_depth, eeat, …). */
export interface DeepSignal {
   name: string;
   score: number;
   verdict: string;
   recommendation: string;
}

/** The sidecar `score_ranking` output: a final 0-100 score + the 6-signal breakdown. */
export interface DeepResult {
   ranking_score: number;
   ranking_signals: DeepSignal[];
}

/** Raw `score_ranking` block from the sidecar pipeline result (loosely typed). */
interface SidecarScoreRanking {
   ranking_score?: number;
   ranking_signals?: unknown;
}

/** Narrow an unknown sidecar `ranking_signals` value to DeepSignal[]. */
function toSignals(raw: unknown): DeepSignal[] {
   if (!Array.isArray(raw)) return [];
   return raw
      .filter((s): s is Record<string, unknown> => !!s && typeof s === 'object')
      .map((s) => ({
         name: String(s.name ?? ''),
         score: Number(s.score ?? 0),
         verdict: String(s.verdict ?? ''),
         recommendation: String(s.recommendation ?? ''),
      }));
}

/**
 * Run the hybrid deep-analysis (sidecar `score_ranking`) for a single page URL and
 * return its final score + 6-signal breakdown. Throws on a non-2xx sidecar response.
 */
export async function runDeepAnalysisForUrl(url: string, keyword = ''): Promise<DeepResult> {
   const jobId = `pad_${Date.now()}`;
   const payload = { url, keyword, keywords: keyword ? [keyword] : [], language: 'en', tone: 'professional' };

   const controller = new AbortController();
   const timeout = setTimeout(() => controller.abort(), 180_000); // 3 min, mirrors deep-analysis.ts
   let resp: Response;
   try {
      resp = await fetch(`${sidecarBase()}/pipeline/deep-analysis`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json', 'x-internal-token': process.env.INTERNAL_PIPELINE_TOKEN || '' },
         body: JSON.stringify({ jobId, payload }),
         signal: controller.signal,
      });
   } finally {
      clearTimeout(timeout);
   }
   if (!resp.ok) {
      throw new Error((await resp.text().catch(() => '')) || `sidecar deep-analysis failed (${resp.status})`);
   }

   const data = (await resp.json()) as { result?: { score_ranking?: SidecarScoreRanking } };
   const score = data.result?.score_ranking || {};
   return {
      ranking_score: Number(score.ranking_score ?? 0),
      ranking_signals: toSignals(score.ranking_signals),
   };
}
