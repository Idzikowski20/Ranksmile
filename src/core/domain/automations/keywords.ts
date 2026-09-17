/** One scheduled keyword becomes one article; this caps how many a single schedule makes. */
export const MAX_KEYWORDS_PER_SCHEDULE = 10;
const MAX_KEYWORD_LENGTH = 200;

/**
 * The keywords a schedule request asks for: strings only, whitespace collapsed, empties
 * dropped, case-insensitive duplicates removed (first spelling wins), capped in length and
 * count. Shared by the add dialog and the API so both agree on how many articles result.
 */
export function normalizeKeywords(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    // Cut by code points so a surrogate pair at the boundary stays whole.
    const kw = Array.from(item.replace(/\s+/g, ' ').trim()).slice(0, MAX_KEYWORD_LENGTH).join('').trim();
    const key = kw.toLowerCase();
    if (!kw || seen.has(key)) continue;
    seen.add(key);
    out.push(kw);
    if (out.length === MAX_KEYWORDS_PER_SCHEDULE) break;
  }
  return out;
}
