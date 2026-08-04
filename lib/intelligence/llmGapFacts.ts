/**
 * Fact Engine v3: one LLM call to locate in-article quotes for weak/missing gaps.
 * Never invents facts — only quotes from the article body.
 */
import { generateText } from 'ai';
import { deepseek, chatLlm } from '../ai/deepseek';
import { parseJsonish } from '../types/json';

export type GapLocateInput = {
  readonly id: string;
  readonly statement: string;
};

export type GapLocateHit = {
  readonly id: string;
  readonly quote: string;
};

type LlmRow = { id?: unknown; quote?: unknown };

function extractJsonArray(text: string): unknown {
  const trimmed = text.trim();
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
  const raw = fence ? fence[1].trim() : trimmed;
  const start = raw.indexOf('[');
  const end = raw.lastIndexOf(']');
  if (start >= 0 && end > start) {
    return parseJsonish(raw.slice(start, end + 1));
  }
  return parseJsonish(raw);
}

/**
 * For each gap, ask model for a verbatim quote from article that supports it.
 * Returns only hits with quote length ≥ 20 present in article (substring check).
 */
export async function locateGapEvidenceWithLlm(opts: {
  readonly articlePlain: string;
  readonly gaps: readonly GapLocateInput[];
}): Promise<readonly GapLocateHit[]> {
  const cfg = chatLlm();
  if (!cfg.apiKey) return [];
  const gaps = opts.gaps.slice(0, 6);
  if (!gaps.length) return [];
  const article = opts.articlePlain.slice(0, 12_000);
  if (article.length < 80) return [];

  const prompt = `Jesteś ekstraktorem cytatów. Artykuł (PL/EN):
---
${article}
---
Luki (JSON): ${JSON.stringify(gaps.map((g) => ({ id: g.id, need: g.statement })))}

Dla każdej luki, jeśli w artykule JEST dosłowny fragment (≥20 znaków) który ją pokrywa, zwróć {"id","quote"}.
Jeśli nie ma — pomiń lukę. NIE wymyślaj. Zwróć TYLKO JSON array.`;

  try {
    const { text } = await generateText({
      model: deepseek(),
      prompt,
      temperature: 0,
      maxOutputTokens: 800,
    });
    const parsed = extractJsonArray(text);
    if (!Array.isArray(parsed)) return [];
    const hits: GapLocateHit[] = [];
    const lowerArticle = article.toLocaleLowerCase('pl');
    for (const row of parsed as LlmRow[]) {
      if (typeof row?.id !== 'string' || typeof row?.quote !== 'string') continue;
      const quote = row.quote.replace(/\s+/g, ' ').trim();
      if (quote.length < 20) continue;
      if (!lowerArticle.includes(quote.toLocaleLowerCase('pl').slice(0, 40))) continue;
      hits.push({ id: row.id, quote });
    }
    return hits;
  } catch {
    return [];
  }
}
