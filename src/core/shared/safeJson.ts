/**
 * Parse JSON without throwing. One corrupt DB row / truncated LLM response should degrade to a
 * fallback, not 500 the whole list. Returns `fallback` on null/empty/invalid input.
 */
export function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (raw == null || raw === '') return fallback;
  try {
    const v = JSON.parse(raw);
    return (v ?? fallback) as T;
  } catch {
    return fallback;
  }
}
