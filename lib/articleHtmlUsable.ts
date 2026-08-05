/** Shared empty-article guard (mirrors python-sidecar pipeline + job-progress). */

export function stripHtmlToPlain(html: string): string {
  return (html || '')
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/&nbsp;|&#160;|&#xA0;/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isUsableArticleHtml(html: string, minPlain = 80): boolean {
  return stripHtmlToPlain(html).length >= minPlain;
}
