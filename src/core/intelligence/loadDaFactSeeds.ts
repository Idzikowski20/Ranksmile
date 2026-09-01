/**
 * Load DA / AI-visibility citation seeds for Fact Engine v2 (no LLM in compile).
 */
import { hashId } from '@/src/core/domain/coverage/aiCoverage';
import { factReadinessScore } from '@/src/core/domain/articles/factReadiness';

import type { CitedEngine } from '@/src/core/ccm/types/graph';

export type DaFactSeed = {
  readonly id: string;
  readonly statement: string;
  readonly prompt: string;
  readonly url?: string;
  readonly domain?: string;
  readonly readiness: number;
  /** AI engines that cited this fact (from the 4-engine harvest). */
  readonly citedBy?: readonly CitedEngine[];
  /** All source websites behind the fact — becomes multiple citation nodes. */
  readonly sourceUrls?: readonly string[];
};

/** Sidecar `cited_by` label → CCM engine (same taxonomy as LlmCoverageSource). */
function toCitedEngine(label: string): CitedEngine | null {
  switch (label) {
    case 'perplexity': return 'perplexity';
    case 'gemini': return 'gemini';
    case 'openai': case 'chat_gpt': return 'chat_gpt';
    case 'google': case 'ai_overview': case 'ai_mode': return 'ai_overview';
    case 'reddit': return 'reddit';
    default: return null;
  }
}

function domainOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}

type ResearchedFactSource = {
  url?: string;
  cited_by?: readonly string[];
  source_urls?: readonly string[];
};

/** Map the sidecar's 4-engine researched facts (claims + per-fact engine/source attribution)
 *  into DA seeds, so their engines and source websites reach the coverage panel. */
export function researchedFactsToDaSeeds(
  facts: { claims?: readonly string[]; sources?: readonly ResearchedFactSource[] } | null | undefined,
  articlePlain: string,
  limit = 40,
): readonly DaFactSeed[] {
  const claims = facts?.claims ?? [];
  const sources = facts?.sources ?? [];
  const out: DaFactSeed[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < claims.length && out.length < limit; i += 1) {
    const statement = (claims[i] || '').replace(/\s+/g, ' ').trim();
    if (statement.length < 12) continue;
    const key = statement.toLocaleLowerCase('pl');
    if (seen.has(key)) continue;
    seen.add(key);
    const src = sources[i] || {};
    const citedBy = [...new Set(
      (src.cited_by ?? []).map(toCitedEngine).filter((e): e is CitedEngine => e !== null),
    )];
    const urls = [...new Set([...(src.source_urls ?? []), ...(src.url ? [src.url] : [])].filter(Boolean))];
    out.push({
      id: `rf_${hashId(statement)}`,
      statement,
      prompt: statement,
      readiness: factReadinessScore(articlePlain, statement),
      ...(urls[0] ? { url: urls[0], domain: domainOf(urls[0]) } : {}),
      ...(citedBy.length ? { citedBy } : {}),
      ...(urls.length ? { sourceUrls: urls.slice(0, 6) } : {}),
    });
  }
  return out;
}

type CitationRow = {
  prompt: string | null;
  answer: string | null;
  cited_url: string | null;
  cited_domain: string | null;
};

function pickStatement(prompt: string, answer: string): string {
  const a = answer.replace(/\s+/g, ' ').trim();
  if (a.length >= 20 && a.length <= 280) return a;
  const p = prompt.replace(/\s+/g, ' ').trim();
  return p;
}

/** Map AI-visibility citation rows + article plain → seeds (pure). */
export function citationsToDaFactSeeds(
  rows: readonly CitationRow[],
  articlePlain: string,
  limit = 40,
): readonly DaFactSeed[] {
  const out: DaFactSeed[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (out.length >= limit) break;
    const prompt = (row.prompt || '').replace(/\s+/g, ' ').trim();
    if (prompt.length < 8) continue;
    const answer = (row.answer || '').replace(/\s+/g, ' ').trim();
    const statement = pickStatement(prompt, answer);
    if (statement.length < 12) continue;
    const key = statement.toLocaleLowerCase('pl');
    if (seen.has(key)) continue;
    seen.add(key);
    const readiness = factReadinessScore(articlePlain, statement);
    out.push({
      id: `da_${hashId(statement)}`,
      statement,
      prompt,
      ...(row.cited_url ? { url: row.cited_url } : {}),
      ...(row.cited_domain ? { domain: row.cited_domain } : {}),
      readiness,
    });
  }
  return out;
}

/** Latest AI-visibility citations for article (DB). Empty when no run. */
export async function loadDaFactSeeds(
  articleId: number,
  articlePlain: string,
): Promise<readonly DaFactSeed[]> {
  const { queryRows } = await import('@/src/infrastructure/db/query');
  const rows = await queryRows<CitationRow>(
    `SELECT c.prompt, c.answer, c.cited_url, c.cited_domain
     FROM ai_visibility_citations c
     WHERE c.run_id = (
       SELECT id FROM ai_visibility_runs
       WHERE article_id = ?
       ORDER BY created_at DESC
       LIMIT 1
     )
     ORDER BY c.id ASC
     LIMIT 60`,
    [articleId],
  );
  return citationsToDaFactSeeds(rows, articlePlain);
}
