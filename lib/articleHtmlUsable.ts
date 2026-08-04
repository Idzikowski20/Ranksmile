/** Shared empty-article guard (mirrors python-sidecar pipeline + job-progress). */

export function stripHtmlToPlain(html: string): string {
  return (html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function isUsableArticleHtml(html: string, minPlain = 80): boolean {
  return stripHtmlToPlain(html).length >= minPlain;
}
