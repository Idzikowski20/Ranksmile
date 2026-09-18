/**
 * Plain text from an HTML fragment.
 *
 * script/style bodies are dropped before tags, otherwise their contents leak
 * into the text and get counted as prose by the scoring paths that call this.
 */
export function stripTags(html: string): string {
  return (html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
};

/** Escape text for interpolation into an HTML template. */
export function escapeHtml(s: string): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => HTML_ENTITIES[c]);
}
