// Normalize a model reply that may be a fenced / bare JSON object back into a usable object.
// DeepSeek-chat sometimes answers with a ```json { "action", "message", "content" } ``` blob
// instead of prose (or instead of calling tools); without this the raw blob leaks into the UI.

/** Strip a single leading/trailing ``` or ```json code fence, if present. */
export function stripCodeFence(raw: string): string {
  if (!raw) return '';
  const fenced = raw.trim().match(/^```(?:json|html)?\s*\n?([\s\S]*?)\n?```$/i);
  return (fenced ? fenced[1] : raw).trim();
}

/** Extract the first balanced JSON object from `raw` (handles ```json fences and surrounding prose).
 *  Returns the parsed object, or null if no parseable object is found. */
export function extractJsonObject(raw: string): Record<string, unknown> | null {
  if (!raw) return null;
  const candidates = [raw.trim(), stripCodeFence(raw)];
  for (const text of candidates) {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end <= start) continue;
    try {
      const parsed = JSON.parse(text.slice(start, end + 1));
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
    } catch { /* try next candidate */ }
  }
  return null;
}

/** True when the parsed object looks like the legacy Surfy reply protocol ({message|content|action}). */
export function isSurfyReplyShape(obj: Record<string, unknown> | null): boolean {
  if (!obj) return false;
  return typeof obj.message === 'string' || 'content' in obj || typeof obj.action === 'string';
}
