/**
 * Load DA / AI-visibility citation seeds for Fact Engine v2 (no LLM in compile).
 */
import { hashId } from '../aiCoverage';
import { factReadinessScore } from '../factReadiness';

export type DaFactSeed = {
  readonly id: string;
  readonly statement: string;
  readonly prompt: string;
  readonly url?: string;
  readonly domain?: string;
  readonly readiness: number;
};

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
  const { queryRows } = await import('../db/query');
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
